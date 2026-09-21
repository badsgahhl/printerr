<template>
  <div class="flex min-h-0 flex-col gap-3">
    <div class="flex items-center gap-2">
      <Input v-model="query" placeholder="Produkte durchsuchen" class="max-w-xs" />
      <span class="text-muted-foreground text-sm">{{ products.length }} Produkte</span>
      <Button class="ml-auto" size="sm" @click="startNew">
        <Plus class="size-4" />
        Neues Produkt
      </Button>
    </div>

    <p
      v-if="products.length === 0"
      class="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm"
    >
      Noch keine Produkte. Lege eines an — oder importiere unten eine LibreOffice-Tabelle.
    </p>

    <div v-else class="min-h-0 flex-1 overflow-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead class="w-28">ArtNr</TableHead>
            <TableHead class="w-32 text-right">Preis</TableHead>
            <TableHead class="w-40">Zusätze</TableHead>
            <TableHead class="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="product in visible" :key="product.id">
            <TableCell>
              <span class="font-medium">{{ product.name }}</span>
              <span v-if="product.subtitle" class="text-muted-foreground block text-xs">{{ product.subtitle }}</span>
            </TableCell>
            <TableCell class="text-muted-foreground">{{ product.artNr ?? '—' }}</TableCell>
            <TableCell class="text-right tabular-nums">{{ formatCents(product.priceCents) }}</TableCell>
            <TableCell class="text-muted-foreground text-sm">{{ partsSummary(product) }}</TableCell>
            <TableCell class="text-right">
              <Button variant="ghost" size="sm" @click="startEdit(product)">Bearbeiten</Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Dialog v-model:open="dialogOpen">
      <DialogScrollContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{{ isNew ? 'Neues Produkt' : 'Produkt bearbeiten' }}</DialogTitle>
          <DialogDescription>
            Der Preis unten ist der Preis des Produkts allein. Ausgestellte Zusätze kommen für das Schild hinzu.
          </DialogDescription>
        </DialogHeader>

        <div v-if="draft" class="flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <Label for="prod-name">Name</Label>
            <Input id="prod-name" v-model="draft.name" placeholder='z. B. Mühle „Seiffen"' />
          </div>

          <div class="flex flex-col gap-1.5">
            <Label for="prod-sub">Untertitel</Label>
            <Input id="prod-sub" v-model="subtitle" placeholder="z. B. KWO · Erle, handbemalt" />
          </div>

          <div class="flex gap-3">
            <div class="flex flex-1 flex-col gap-1.5">
              <Label for="prod-artnr">Artikelnummer</Label>
              <Input id="prod-artnr" v-model="artNr" placeholder="optional" />
            </div>
            <div class="flex flex-1 flex-col gap-1.5">
              <Label for="prod-price">Preis</Label>
              <MoneyInput v-model="priceCents" />
            </div>
            <div class="flex w-24 flex-col gap-1.5">
              <Label for="prod-copies">Anzahl</Label>
              <Input id="prod-copies" v-model.number="draft.copies" type="number" min="1" step="1" />
            </div>
          </div>

          <div class="flex gap-3">
            <div class="flex flex-1 flex-col gap-1.5">
              <Label for="prod-note">Preiszusatz</Label>
              <Input id="prod-note" v-model="priceNote" placeholder="z. B. ohne Figuren" />
            </div>
            <div class="flex flex-1 flex-col gap-1.5">
              <Label for="prod-hint">Hinweis am Fuß</Label>
              <Input id="prod-hint" v-model="note" placeholder="z. B. Handarbeit aus dem Erzgebirge" />
            </div>
          </div>

          <label class="flex items-center gap-2 text-sm">
            <Checkbox :model-value="draft.preselected" @update:model-value="setPreselected" />
            <span>Beim Öffnen gleich zum Drucken angehakt</span>
          </label>

          <Separator />

          <section class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium">Zusätze</h3>
              <span class="text-muted-foreground text-xs"> „Ausgestellt" zählt zum Preis des gezeigten Stücks </span>
            </div>

            <p v-if="draft.parts.length === 0" class="text-muted-foreground text-sm">
              Keine Zusätze. Unten eines aus dem Teile-Katalog wählen.
            </p>

            <div
              v-for="link in draft.parts"
              :key="link.partId"
              class="flex flex-wrap items-center gap-2 rounded-md border p-2"
            >
              <span class="min-w-32 flex-1 text-sm">
                {{ partName(link.partId) }}
                <span v-if="partArtNr(link.partId)" class="text-muted-foreground text-xs">
                  · Art. {{ partArtNr(link.partId) }}
                </span>
              </span>

              <label class="flex items-center gap-1.5 text-xs">
                <Checkbox
                  :model-value="link.exhibited"
                  @update:model-value="(value) => setExhibited(link.partId, value === true)"
                />
                <span>ausgestellt</span>
              </label>

              <div class="flex items-center gap-1">
                <MoneyInput
                  class="w-28"
                  allow-empty
                  :model-value="link.priceCentsOverride"
                  :placeholder="catalogPriceLabel(link.partId)"
                  @update:model-value="(value) => setOverride(link.partId, value)"
                />
                <Button
                  v-if="link.priceCentsOverride !== null || link.priceTextOverride !== null"
                  variant="ghost"
                  size="sm"
                  title="Katalogpreis wieder verwenden"
                  @click="resetOverride(link.partId)"
                >
                  <RotateCcw class="size-3.5" />
                </Button>
              </div>

              <Button variant="ghost" size="sm" @click="detach(link.partId)">
                <X class="size-4" />
              </Button>
            </div>

            <div class="flex items-end gap-2 pt-1">
              <div class="flex flex-1 flex-col gap-1.5">
                <Label for="prod-addpart">Teil hinzufügen</Label>
                <select
                  id="prod-addpart"
                  v-model="partToAdd"
                  class="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="">Aus dem Katalog wählen …</option>
                  <option v-for="part in attachable" :key="part.id" :value="part.id">
                    {{ part.name }}{{ part.artNr ? ` · ${part.artNr}` : '' }} — {{ partPriceLabel(part) }}
                  </option>
                </select>
              </div>
              <Button variant="secondary" :disabled="partToAdd === ''" @click="attach">Hinzufügen</Button>
            </div>

            <div class="flex items-end gap-2">
              <div class="flex flex-1 flex-col gap-1.5">
                <Label for="prod-newpart">… oder neues Teil anlegen</Label>
                <Input id="prod-newpart" v-model="newPartName" placeholder="Bezeichnung" />
              </div>
              <MoneyInput v-model="newPartPrice" class="w-28" />
              <Button variant="secondary" :disabled="newPartName.trim() === ''" @click="createAndAttach">
                Anlegen
              </Button>
            </div>
          </section>

          <div class="bg-muted rounded-md p-3 text-sm">
            <span class="text-muted-foreground">Auf dem Schild steht groß: </span>
            <strong class="tabular-nums">{{ preview.mainText }}</strong>
            <span v-if="preview.suffix" class="text-muted-foreground"> ({{ preview.suffix }})</span>
          </div>
        </div>

        <DialogFooter class="gap-2 sm:justify-between">
          <Button v-if="!isNew" variant="destructive" size="sm" @click="confirmDelete = true">Löschen</Button>
          <div class="flex gap-2">
            <Button variant="outline" @click="dialogOpen = false">Abbrechen</Button>
            <Button :disabled="!canSave" @click="save">Speichern</Button>
          </div>
        </DialogFooter>
      </DialogScrollContent>
    </Dialog>

    <AlertDialog v-model:open="confirmDelete">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Produkt löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            „{{ draft?.name }}" wird gelöscht. Die zugeordneten Teile bleiben im Katalog erhalten.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction @click="remove">Löschen</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup lang="ts">
import { Plus, RotateCcw, X } from '@lucide/vue'
import { computed, ref } from 'vue'

import MoneyInput from '@/components/data/MoneyInput.vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogScrollContent,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { catalogState } from '@/composables/use-catalog'
import { resolveLabel } from '@/lib/catalog/resolve'
import { type Draft, makeId, type Part, type Product } from '@/lib/catalog/types'
import { computePriceView, formatCents } from '@/lib/price'

const products = catalogState.products
const query = ref('')
const dialogOpen = ref(false)
const confirmDelete = ref(false)
const draft = ref<Draft<Product> | null>(null)
const isNew = ref(false)
const partToAdd = ref('')
const newPartName = ref('')
const newPartPrice = ref<number | null>(0)

const visible = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (needle.length === 0) return products.value
  return products.value.filter((product) =>
    [product.name, product.artNr, product.subtitle]
      .filter((field) => field !== null)
      .some((field) => field.toLowerCase().includes(needle))
  )
})

const partIndex = computed(() => new Map(catalogState.parts.value.map((part) => [part.id, part])))
const attachable = computed(() =>
  catalogState.parts.value.filter((part) => !draft.value?.parts.some((link) => link.partId === part.id))
)

const canSave = computed(() => (draft.value?.name.trim().length ?? 0) > 0)

/** What the label would print with the current, unsaved form values. */
const preview = computed(() => {
  if (!draft.value) return { mainText: '—', suffix: null as string | null }
  const view = computePriceView(resolveLabel(draft.value as Product, partIndex.value))
  return { mainText: view.mainText, suffix: view.suffix }
})

const bind = <K extends 'subtitle' | 'artNr' | 'priceNote' | 'note'>(key: K) =>
  computed({
    get: () => draft.value?.[key] ?? '',
    set: (value: string) => void (draft.value && (draft.value[key] = value.trim() || null))
  })

const subtitle = bind('subtitle')
const artNr = bind('artNr')
const priceNote = bind('priceNote')
const note = bind('note')

const priceCents = computed({
  get: () => draft.value?.priceCents ?? 0,
  set: (value: number | null) => void (draft.value && (draft.value.priceCents = value ?? 0))
})

const partName = (partId: string): string => partIndex.value.get(partId)?.name ?? '(gelöschtes Teil)'
const partArtNr = (partId: string): string | null => partIndex.value.get(partId)?.artNr ?? null

const partPriceLabel = (part: Part): string =>
  part.priceCents !== null ? formatCents(part.priceCents) : (part.priceText ?? 'ohne Preis')

const catalogPriceLabel = (partId: string): string => {
  const part = partIndex.value.get(partId)
  return part ? partPriceLabel(part) : '—'
}

function partsSummary(product: Product): string {
  if (product.parts.length === 0) return '—'
  const exhibited = product.parts.filter((link) => link.exhibited).length
  const total = `${product.parts.length} ${product.parts.length === 1 ? 'Teil' : 'Teile'}`
  return exhibited > 0 ? `${total}, ${exhibited} ausgestellt` : total
}

const setPreselected = (value: boolean | 'indeterminate') =>
  void (draft.value && (draft.value.preselected = value === true))

function setExhibited(partId: string, exhibited: boolean): void {
  if (!draft.value) return
  draft.value.parts = draft.value.parts.map((link) => (link.partId === partId ? { ...link, exhibited } : link))
}

function setOverride(partId: string, value: number | null): void {
  if (!draft.value) return
  draft.value.parts = draft.value.parts.map((link) =>
    link.partId === partId ? { ...link, priceCentsOverride: value, priceTextOverride: null } : link
  )
}

function resetOverride(partId: string): void {
  if (!draft.value) return
  draft.value.parts = draft.value.parts.map((link) =>
    link.partId === partId ? { ...link, priceCentsOverride: null, priceTextOverride: null } : link
  )
}

function detach(partId: string): void {
  if (!draft.value) return
  draft.value.parts = draft.value.parts.filter((link) => link.partId !== partId)
}

function attach(): void {
  if (!draft.value || partToAdd.value === '') return
  draft.value.parts = [
    ...draft.value.parts,
    { partId: partToAdd.value, exhibited: false, priceCentsOverride: null, priceTextOverride: null }
  ]
  partToAdd.value = ''
}

/**
 * Create a part and hang it on this product in one go.
 *
 * The part lands in the catalogue immediately, not on save: it is an entry in
 * its own right, and having to leave the dialog to create one would make adding
 * a figure a three-step chore.
 */
function createAndAttach(): void {
  if (!draft.value || newPartName.value.trim() === '') return
  const part: Part = {
    id: makeId('t'),
    name: newPartName.value.trim(),
    artNr: null,
    priceCents: newPartPrice.value ?? 0,
    priceText: null
  }
  catalogState.savePart(part)
  draft.value.parts = [
    ...draft.value.parts,
    { partId: part.id, exhibited: false, priceCentsOverride: null, priceTextOverride: null }
  ]
  newPartName.value = ''
  newPartPrice.value = 0
}

function startNew(): void {
  draft.value = catalogState.newProduct()
  isNew.value = true
  resetForm()
}

function startEdit(product: Product): void {
  draft.value = { ...product, parts: product.parts.map((link) => ({ ...link })) }
  isNew.value = false
  resetForm()
}

function resetForm(): void {
  partToAdd.value = ''
  newPartName.value = ''
  newPartPrice.value = 0
  dialogOpen.value = true
}

function save(): void {
  if (!draft.value || !canSave.value) return
  catalogState.saveProduct({
    ...draft.value,
    name: draft.value.name.trim(),
    copies: Math.max(1, Math.trunc(Number(draft.value.copies) || 1))
  })
  dialogOpen.value = false
}

function remove(): void {
  if (draft.value) catalogState.deleteProduct(draft.value.id)
  confirmDelete.value = false
  dialogOpen.value = false
}
</script>
