import { computed, ref, shallowRef, toRaw } from 'vue'

import { type CatalogStore, createCatalogStore, type StoreKind } from '@/infra/catalog-store'
import { parseBackup, toBackup } from '@/lib/catalog/backup'
import { catalogFromLabels } from '@/lib/catalog/import'
import * as mutate from '@/lib/catalog/mutate'
import { partsById, partUsage, resolveLabels } from '@/lib/catalog/resolve'
import { type Catalog, EMPTY_CATALOG, makeId, type Part, type Product } from '@/lib/catalog/types'
import { readOds } from '@/lib/ods/read-ods'
import { buildLabels } from '@/lib/schema/build-labels'
import type { Diagnostic } from '@/lib/types'

/**
 * The price list the shop edits.
 *
 * A thin reactive shell: every change is a pure function in lib/catalog, applied
 * here and written back to storage. `shallowRef` rather than `reactive` because
 * the catalogue is replaced wholesale on each edit -- a deep proxy over hundreds
 * of records would cost a lot and buy nothing.
 */

/** Saving is debounced: typing in a form should not hit storage on every keystroke. */
const SAVE_DELAY_MS = 400

/**
 * Unwrap the reactive proxies a form hands back.
 *
 * Records edited in a dialog live in a `ref`, and anything read out of one comes
 * back as a proxy. IndexedDB serialises with structuredClone, which refuses
 * those outright -- "DataCloneError: [object Object] could not be cloned".
 *
 * `toRaw` only unwraps the object it is given, so the attachments have to be
 * unwrapped in their own right: they sit one level down and are exactly what
 * broke the clone. Keeping the catalogue plain here means the store never has to
 * care where a record came from.
 */
function plainProduct(product: Product): Product {
  const raw = toRaw(product)
  return { ...raw, parts: toRaw(raw.parts).map((link) => toRaw(link)) }
}

export function createCatalog(deps: { store?: CatalogStore } = {}) {
  const catalog = shallowRef<Catalog>(EMPTY_CATALOG)
  const diagnostics = ref<readonly Diagnostic[]>([])
  const ready = ref(false)
  const storeKind = ref<StoreKind>('indexeddb')
  const persistent = ref(true)
  const lastImport = ref<string | null>(null)

  let store: CatalogStore | null = deps.store ?? null
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  async function open(): Promise<CatalogStore> {
    store ??= await createCatalogStore()
    storeKind.value = store.kind
    persistent.value = store.persistent
    return store
  }

  async function init(): Promise<void> {
    const opened = await open()
    catalog.value = await opened.load()
    ready.value = true
  }

  function scheduleSave(): void {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => void flush(), SAVE_DELAY_MS)
  }

  /** Write now rather than waiting out the debounce -- used before export and on unload. */
  async function flush(): Promise<void> {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    const opened = await open()
    await opened.save(catalog.value)
  }

  function apply(next: Catalog): void {
    catalog.value = next
    scheduleSave()
  }

  const labels = computed(() => resolveLabels(catalog.value))
  const usage = computed(() => partUsage(catalog.value))
  const parts = computed(() => [...catalog.value.parts].sort((a, b) => a.name.localeCompare(b.name, 'de')))
  const products = computed(() => [...catalog.value.products].sort((a, b) => a.sortIndex - b.sortIndex))

  function newProduct(): Product {
    return {
      id: makeId('p'),
      name: '',
      subtitle: null,
      artNr: null,
      priceCents: 0,
      priceNote: null,
      note: null,
      copies: 1,
      preselected: true,
      layout: null,
      parts: [],
      sortIndex: catalog.value.products.length
    }
  }

  function newPart(): Part {
    return { id: makeId('t'), name: '', artNr: null, priceCents: 0, priceText: null }
  }

  /**
   * Replace everything with what a spreadsheet contains.
   *
   * Import replaces rather than merges: the sheet is the shop's own list, and
   * silently mixing two versions of it would be far harder to unpick than
   * re-importing.
   */
  async function importOds(file: File): Promise<void> {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const read = readOds(bytes)
    const built = buildLabels(read.sheets)
    diagnostics.value = [...read.diagnostics, ...built.diagnostics]
    apply(catalogFromLabels(built.labels).catalog)
    lastImport.value = file.name
  }

  function importBackupJson(json: string): { ok: true } | { ok: false; error: string } {
    const result = parseBackup(json)
    if (!result.ok) return { ok: false, error: result.error }
    diagnostics.value = []
    apply(result.catalog)
    return { ok: true }
  }

  const backupJson = (): string => JSON.stringify(toBackup(catalog.value), null, 2)

  async function clearAll(): Promise<void> {
    catalog.value = EMPTY_CATALOG
    diagnostics.value = []
    lastImport.value = null
    const opened = await open()
    await opened.clear()
  }

  return {
    catalog,
    products,
    parts,
    labels,
    usage,
    diagnostics,
    ready,
    storeKind,
    persistent,
    lastImport,

    init,
    flush,
    partsById: () => partsById(catalog.value.parts),

    newProduct,
    newPart,
    saveProduct: (product: Product) => apply(mutate.upsertProduct(catalog.value, plainProduct(product))),
    deleteProduct: (id: string) => apply(mutate.removeProduct(catalog.value, id)),
    savePart: (part: Part) => apply(mutate.upsertPart(catalog.value, { ...toRaw(part) })),
    deletePart: (id: string) => apply(mutate.removePart(catalog.value, id)),
    attachPart: (productId: string, partId: string, exhibited = false) =>
      apply(mutate.attachPart(catalog.value, productId, partId, { exhibited })),
    detachPart: (productId: string, partId: string) => apply(mutate.detachPart(catalog.value, productId, partId)),
    updateAttachment: (productId: string, partId: string, change: Parameters<typeof mutate.updateAttachment>[3]) =>
      apply(mutate.updateAttachment(catalog.value, productId, partId, { ...toRaw(change) })),
    clearOverride: (productId: string, partId: string) => apply(mutate.clearOverride(catalog.value, productId, partId)),
    reorder: (ids: readonly string[]) => apply(mutate.reorderProducts(catalog.value, ids)),

    importOds,
    importBackupJson,
    backupJson,
    clearAll
  }
}

export type CatalogState = ReturnType<typeof createCatalog>

export const catalogState = createCatalog()
