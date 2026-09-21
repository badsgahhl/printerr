import { describe, expect, it } from 'vitest'
import { reactive, ref } from 'vue'

import { createCatalog } from '@/composables/use-catalog'
import type { CatalogStore } from '@/infra/catalog-store'
import type { Catalog, Draft, Part, Product } from '@/lib/catalog/types'
import { EMPTY_CATALOG } from '@/lib/catalog/types'

/** A store that keeps what it is given, so a test can inspect what would be written. */
function fakeStore(): CatalogStore & { written: Catalog | null } {
  const state = {
    kind: 'indexeddb' as const,
    persistent: true,
    written: null as Catalog | null,
    load: () => Promise.resolve(EMPTY_CATALOG),
    save(catalog: Catalog) {
      state.written = catalog
      return Promise.resolve()
    },
    clear: () => Promise.resolve()
  }
  return state
}

const part = (over: Partial<Part> = {}): Part => ({
  id: 't1',
  name: 'Bergmann',
  artNr: '4712',
  priceCents: 12_900,
  priceText: null,
  ...over
})

const product = (over: Partial<Product> = {}): Product => ({
  id: 'p1',
  name: 'Mühle',
  subtitle: 'KWO · Erle',
  artNr: '4711',
  priceCents: 89_000,
  priceNote: 'ohne Figuren',
  note: null,
  copies: 1,
  preselected: true,
  layout: null,
  parts: [{ partId: 't1', exhibited: true, priceCentsOverride: null, priceTextOverride: null }],
  sortIndex: 0,
  ...over
})

describe('the catalogue holds plain records', () => {
  /*
   * IndexedDB serialises with structuredClone, which throws on a Vue proxy:
   * "DataCloneError: [object Object] could not be cloned". Anything read out of
   * a form's ref is such a proxy, so what arrives from a dialog has to be
   * unwrapped before it enters the catalogue.
   */

  it('unwraps a product that came out of a form ref', () => {
    const state = createCatalog({ store: fakeStore() })
    const draft = ref(product())

    state.saveProduct({ ...draft.value })

    expect(() => structuredClone(state.catalog.value)).not.toThrow()
  })

  it('unwraps the attachments too, one level further down', () => {
    // The nested links are what actually broke: spreading the product produces a
    // fresh object, but its `parts` array is still the proxy.
    const state = createCatalog({ store: fakeStore() })
    const draft = ref(product())

    state.saveProduct({ ...draft.value, name: 'Geändert' })

    const stored = state.catalog.value.products[0]!
    expect(() => structuredClone(stored.parts)).not.toThrow()
    expect(stored.parts).toEqual(product().parts)
  })

  it('unwraps parts as well', () => {
    const state = createCatalog({ store: fakeStore() })
    const draft = reactive(part())

    state.savePart(draft)

    expect(() => structuredClone(state.catalog.value.parts)).not.toThrow()
  })

  it('unwraps an attachment change', () => {
    const state = createCatalog({ store: fakeStore() })
    state.savePart(part())
    state.saveProduct(product())

    state.updateAttachment('p1', 't1', reactive({ priceCentsOverride: 13_900 }))

    expect(() => structuredClone(state.catalog.value)).not.toThrow()
    expect(state.catalog.value.products[0]?.parts[0]?.priceCentsOverride).toBe(13_900)
  })

  it('keeps the values while stripping the proxy', () => {
    const state = createCatalog({ store: fakeStore() })
    state.saveProduct({ ...ref(product()).value })

    expect(state.catalog.value.products[0]).toEqual(product())
  })

  it('detaches the stored copy from the form', () => {
    // Otherwise editing on after saving would reach into the catalogue.
    const state = createCatalog({ store: fakeStore() })
    const draft = reactive<Draft<Product>>(product())
    state.saveProduct(draft)

    draft.name = 'Nach dem Speichern geändert'

    expect(state.catalog.value.products[0]?.name).toBe('Mühle')
  })
})
