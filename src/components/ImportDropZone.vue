<template>
  <div
    ref="zone"
    class="rounded-lg border-2 border-dashed p-6 text-center transition-colors"
    :class="isOverDropZone ? 'border-ink bg-black/5' : 'border-rule'"
  >
    <p class="text-ink font-medium">Tabelle hierher ziehen</p>
    <p class="text-ink-soft mt-1 text-sm">LibreOffice-Datei im Format .ods</p>
    <button
      type="button"
      class="border-rule text-ink mt-3 rounded border px-3 py-1.5 text-sm hover:bg-black/5"
      @click="open()"
    >
      … oder Datei auswählen
    </button>
    <p class="text-ink-soft mt-3 text-xs">
      Noch keine Tabelle?
      <a :href="EXAMPLE_ODS_URL" :download="EXAMPLE_ODS_NAME" class="text-ink underline hover:no-underline">
        Beispieltabelle herunterladen
      </a>
    </p>
  </div>
</template>

<script setup lang="ts">
import { useDropZone, useFileDialog } from '@vueuse/core'
import { useTemplateRef } from 'vue'

// `?inline` makes Vite bake the sheet into the bundle as a data URL instead of
// emitting a second file. Both deployments need that: the shop copies nothing
// but index.html, and on GitHub Pages the link keeps working after a rebuild.
import EXAMPLE_ODS_URL from '../../beispiele/preisschilder-beispiel.ods?inline'

const EXAMPLE_ODS_NAME = 'preisschilder-beispiel.ods'

const emit = defineEmits<{ file: [File] }>()

const zone = useTemplateRef<HTMLElement>('zone')

const { isOverDropZone } = useDropZone(zone, {
  multiple: false,
  onDrop: (files) => {
    const file = files?.[0]
    if (file) emit('file', file)
  }
})

const { open, onChange } = useFileDialog({ accept: '.ods', multiple: false, reset: true })

onChange((files) => {
  const file = files?.[0]
  if (file) emit('file', file)
})
</script>
