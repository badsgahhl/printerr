<template>
  <div class="data-workspace flex min-h-0 flex-1 flex-col gap-4 p-4">
    <ImportDropZone v-if="isEmpty" @file="importSheet" />

    <Tabs v-model="tab" class="flex min-h-0 flex-1 flex-col">
      <TabsList class="self-start">
        <TabsTrigger value="products">Produkte</TabsTrigger>
        <TabsTrigger value="parts">Teile</TabsTrigger>
      </TabsList>

      <TabsContent value="products" class="mt-3 min-h-0 flex-1">
        <ProductEditor />
      </TabsContent>

      <TabsContent value="parts" class="mt-3 min-h-0 flex-1">
        <PartEditor />
      </TabsContent>
    </Tabs>

    <DiagnosticsPanel :diagnostics="catalogState.diagnostics.value" />

    <section class="rounded-lg border p-3">
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="mr-2 text-sm font-medium">Sicherung</h2>

        <Button variant="outline" size="sm" @click="saveBackup">
          <Download class="size-4" />
          Sicherung speichern
        </Button>
        <Button variant="outline" size="sm" @click="pickBackup">
          <Upload class="size-4" />
          Sicherung laden
        </Button>

        <Separator orientation="vertical" class="mx-1 h-6" />

        <Button variant="outline" size="sm" @click="exportSheet">
          <FileSpreadsheet class="size-4" />
          Als Tabelle speichern
        </Button>
        <Button variant="outline" size="sm" @click="pickSheet">
          <FileSpreadsheet class="size-4" />
          Tabelle einlesen
        </Button>

        <span class="text-muted-foreground ml-auto text-xs">{{ storageNote }}</span>
      </div>

      <p v-if="message" class="mt-2 text-xs" :class="messageIsError ? 'text-destructive' : 'text-muted-foreground'">
        {{ message }}
      </p>

      <p class="text-muted-foreground mt-2 text-xs">
        Die Daten liegen im Browser dieses Rechners. Eine Sicherung gehört auf ein Netzlaufwerk oder einen Stick — ein
        geleerter Browser nimmt sie sonst mit.
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { Download, FileSpreadsheet, Upload } from '@lucide/vue'
import { useFileDialog } from '@vueuse/core'
import { computed, ref } from 'vue'

import PartEditor from '@/components/data/PartEditor.vue'
import ProductEditor from '@/components/data/ProductEditor.vue'
import DiagnosticsPanel from '@/components/DiagnosticsPanel.vue'
import ImportDropZone from '@/components/ImportDropZone.vue'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { catalogState } from '@/composables/use-catalog'
import { selection } from '@/composables/use-selection'
import { backupFileName } from '@/lib/catalog/backup'
import { catalogToOds } from '@/lib/catalog/to-sheets'

const tab = ref('products')
const message = ref('')
const messageIsError = ref(false)

const isEmpty = computed(() => catalogState.products.value.length === 0 && catalogState.parts.value.length === 0)

const storageNote = computed(() => {
  if (!catalogState.persistent.value) return 'Achtung: dieser Browser speichert nichts dauerhaft'
  return catalogState.storeKind.value === 'indexeddb' ? 'gespeichert im Browser (IndexedDB)' : 'gespeichert im Browser'
})

function say(text: string, isError = false): void {
  message.value = text
  messageIsError.value = isError
}

/** Hand the browser a file. Revoking on the next tick keeps the object URL alive long enough to start. */
function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

async function saveBackup(): Promise<void> {
  await catalogState.flush()
  download(new Blob([catalogState.backupJson()], { type: 'application/json' }), backupFileName())
  say('Sicherung gespeichert.')
}

async function exportSheet(): Promise<void> {
  await catalogState.flush()
  const bytes = catalogToOds(catalogState.catalog.value)
  download(
    new Blob([bytes as BlobPart], { type: 'application/vnd.oasis.opendocument.spreadsheet' }),
    'preisschilder.ods'
  )
  say('Tabelle gespeichert.')
}

const backupDialog = useFileDialog({ accept: '.json,application/json', multiple: false, reset: true })
const sheetDialog = useFileDialog({ accept: '.ods', multiple: false, reset: true })

const pickBackup = () => backupDialog.open()
const pickSheet = () => sheetDialog.open()

backupDialog.onChange(async (files) => {
  const file = files?.[0]
  if (!file) return
  const result = catalogState.importBackupJson(await file.text())
  if (result.ok) {
    selection.applyDefaults(catalogState.labels.value)
    say(`Sicherung „${file.name}" geladen.`)
  } else {
    say(result.error, true)
  }
})

async function importSheet(file: File): Promise<void> {
  await catalogState.importOds(file)
  // The imported list is a different set of products, so the old selection means
  // nothing; the sheet's own Drucken and Anzahl columns decide what is ticked.
  selection.applyDefaults(catalogState.labels.value)
  const errors = catalogState.diagnostics.value.filter((entry) => entry.severity === 'error').length
  say(
    errors > 0
      ? `Tabelle eingelesen, ${errors} Probleme — siehe Liste oben.`
      : `Tabelle „${file.name}" eingelesen: ${catalogState.products.value.length} Produkte, ${catalogState.parts.value.length} Teile.`,
    errors > 0
  )
}

sheetDialog.onChange(async (files) => {
  const file = files?.[0]
  if (file) await importSheet(file)
})
</script>
