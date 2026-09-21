<template>
  <div class="flex min-h-0 flex-col gap-3">
    <div class="flex items-center gap-2">
      <Input v-model="query" placeholder="Teile durchsuchen" class="max-w-xs" />
      <span class="text-muted-foreground text-sm">{{ parts.length }} Teile</span>
      <Button class="ml-auto" size="sm" @click="startNew">
        <Plus class="size-4" />
        Neues Teil
      </Button>
    </div>

    <p v-if="parts.length === 0" class="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
      Noch keine Teile. Teile sind Figuren, Zubehör oder Ersatzstücke, die an mehreren Produkten hängen können — einmal
      angelegt, überall verwendbar.
    </p>

    <div v-else class="min-h-0 flex-1 overflow-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bezeichnung</TableHead>
            <TableHead class="w-28">ArtNr</TableHead>
            <TableHead class="w-32 text-right">Preis</TableHead>
            <TableHead class="w-32">Verwendet</TableHead>
            <TableHead class="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="part in visible" :key="part.id">
            <TableCell class="font-medium">{{ part.name }}</TableCell>
            <TableCell class="text-muted-foreground">{{ part.artNr ?? '—' }}</TableCell>
            <TableCell class="text-right tabular-nums">{{ priceLabel(part) }}</TableCell>
            <TableCell class="text-muted-foreground text-sm">{{ usageLabel(part.id) }}</TableCell>
            <TableCell class="text-right">
              <Button variant="ghost" size="sm" @click="startEdit(part)">Bearbeiten</Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ isNew ? 'Neues Teil' : 'Teil bearbeiten' }}</DialogTitle>
          <DialogDescription>
            Der Preis hier gilt überall, wo das Teil hängt. Einzelne Produkte können ihn überschreiben.
          </DialogDescription>
        </DialogHeader>

        <div v-if="draft" class="flex flex-col gap-3">
          <div class="flex flex-col gap-1.5">
            <Label for="part-name">Bezeichnung</Label>
            <Input id="part-name" v-model="draft.name" placeholder="z. B. Bergmann" />
          </div>

          <div class="flex gap-3">
            <div class="flex flex-1 flex-col gap-1.5">
              <Label for="part-artnr">Artikelnummer</Label>
              <Input id="part-artnr" v-model="artNr" placeholder="optional" />
            </div>
            <div class="flex flex-1 flex-col gap-1.5">
              <Label for="part-price">Preis</Label>
              <MoneyInput v-model="priceCents" allow-empty placeholder="leer lassen für Freitext" />
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <Label for="part-text">Preistext statt Betrag</Label>
            <Input id="part-text" v-model="priceText" placeholder="z. B. ab 90,00 €" />
            <p class="text-muted-foreground text-xs">
              Nur nötig, wenn es keinen festen Preis gibt. Ein Teil ohne Betrag kann nicht in einen Ausstellungspreis
              einfließen.
            </p>
          </div>

          <p v-if="usedBy > 0" class="text-muted-foreground text-xs">
            Hängt aktuell an {{ usedBy }} {{ usedBy === 1 ? 'Produkt' : 'Produkten' }}.
          </p>
        </div>

        <DialogFooter class="gap-2 sm:justify-between">
          <Button v-if="!isNew" variant="destructive" size="sm" @click="confirmDelete = true">Löschen</Button>
          <div class="flex gap-2">
            <Button variant="outline" @click="dialogOpen = false">Abbrechen</Button>
            <Button :disabled="!canSave" @click="save">Speichern</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog v-model:open="confirmDelete">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Teil löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            <template v-if="usedBy > 0">
              „{{ draft?.name }}" hängt an {{ usedBy }} {{ usedBy === 1 ? 'Produkt' : 'Produkten' }} und wird dort mit
              entfernt. Die Produkte selbst bleiben.
            </template>
            <template v-else> „{{ draft?.name }}" wird gelöscht. </template>
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
import { Plus } from '@lucide/vue'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { catalogState } from '@/composables/use-catalog'
import type { Draft, Part } from '@/lib/catalog/types'
import { formatCents } from '@/lib/price'

const parts = catalogState.parts
const query = ref('')
const dialogOpen = ref(false)
const confirmDelete = ref(false)
const draft = ref<Draft<Part> | null>(null)
const isNew = ref(false)

const visible = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (needle.length === 0) return parts.value
  return parts.value.filter((part) =>
    [part.name, part.artNr].filter((field) => field !== null).some((field) => field.toLowerCase().includes(needle))
  )
})

const usedBy = computed(() => (draft.value ? (catalogState.usage.value.get(draft.value.id) ?? 0) : 0))
const canSave = computed(() => (draft.value?.name.trim().length ?? 0) > 0)

// Text fields bind through null so an empty box means "not set" rather than "".
const artNr = computed({
  get: () => draft.value?.artNr ?? '',
  set: (value: string) => void (draft.value && (draft.value.artNr = value.trim() || null))
})
const priceText = computed({
  get: () => draft.value?.priceText ?? '',
  set: (value: string) => void (draft.value && (draft.value.priceText = value.trim() || null))
})
const priceCents = computed({
  get: () => draft.value?.priceCents ?? null,
  set: (value: number | null) => void (draft.value && (draft.value.priceCents = value))
})

const priceLabel = (part: Part): string =>
  part.priceCents !== null ? formatCents(part.priceCents) : (part.priceText ?? '—')

function usageLabel(partId: string): string {
  const count = catalogState.usage.value.get(partId) ?? 0
  if (count === 0) return 'nirgends'
  return count === 1 ? '1 Produkt' : `${count} Produkte`
}

function startNew(): void {
  draft.value = catalogState.newPart()
  isNew.value = true
  dialogOpen.value = true
}

function startEdit(part: Part): void {
  draft.value = { ...part }
  isNew.value = false
  dialogOpen.value = true
}

function save(): void {
  if (!draft.value || !canSave.value) return
  catalogState.savePart({ ...draft.value, name: draft.value.name.trim() })
  dialogOpen.value = false
}

function remove(): void {
  if (draft.value) catalogState.deletePart(draft.value.id)
  confirmDelete.value = false
  dialogOpen.value = false
}
</script>
