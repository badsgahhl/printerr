<template>
  <div class="app-shell text-ink flex h-screen bg-neutral-100">
    <aside class="app-chrome border-rule flex w-96 shrink-0 flex-col gap-4 overflow-y-auto border-r bg-white p-4">
      <header>
        <h1 class="text-lg font-semibold">Preisschilder</h1>
        <p v-if="library.source.value" class="text-ink-soft text-xs">
          {{ library.source.value.fileName }} · {{ library.labels.value.length }} Schilder
        </p>
      </header>

      <ImportDropZone @file="handleFile" />

      <p v-if="!library.storagePersistent" class="rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
        Dieser Browser speichert lokal nichts — nach dem Neuladen muss die Tabelle erneut geladen werden.
      </p>

      <DiagnosticsPanel :diagnostics="library.diagnostics.value" />

      <LabelPicker
        class="min-h-64 flex-1"
        :labels="library.labels.value"
        :is-selected="selection.isSelected"
        :copies-of="selection.copiesOf"
        :overflowing="autoFit.overflowing.value"
        @toggle="selection.toggle"
        @set-copies="selection.setCopies"
        @select-all="selection.selectAll(library.labels.value)"
        @clear="selection.clearSelection()"
      />

      <SheetStartPicker :is-blocked="selection.isBlocked" @toggle="selection.toggleBlockedSlot" />

      <StyleSettings
        :label-style="settings.state.labelStyle"
        :is-default="settings.isStyleDefault()"
        @change="settings.setStyle"
        @reset="settings.resetStyle"
      />

      <fieldset class="flex flex-col gap-2 text-sm">
        <legend class="text-ink text-sm font-medium">Schild-Fuß</legend>
        <label class="flex items-center gap-2">
          <input v-model="settings.state.brandEnabled" type="checkbox" class="size-4" />
          <span>Ladenname aufs Schild</span>
        </label>
        <input
          v-model="settings.state.brandText"
          type="text"
          placeholder="Name des Geschäfts"
          class="border-rule rounded border px-2 py-1"
          :disabled="!settings.state.brandEnabled"
        />
        <label class="flex items-center gap-2">
          <input v-model="settings.state.showRuler" type="checkbox" class="size-4" />
          <span>Maßstab-Lineal mitdrucken</span>
        </label>
      </fieldset>

      <section class="border-rule rounded-lg border p-3 text-xs">
        <p class="text-ink font-medium">Vor dem Drucken im Dialog prüfen</p>
        <ul class="text-ink-soft mt-1 list-disc pl-4">
          <li>Ränder: <strong>Keine</strong></li>
          <li>Kopf- und Fußzeilen: <strong>aus</strong></li>
          <li>Skalierung: <strong>Standard</strong> (100 %)</li>
        </ul>
      </section>

      <button
        type="button"
        class="bg-ink rounded px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        :disabled="sheets.length === 0"
        @click="print"
      >
        {{
          sheets.length === 0
            ? 'Nichts ausgewählt'
            : `${selection.labelCount.value} Schilder auf ${sheets.length} Bogen drucken`
        }}
      </button>
    </aside>

    <main class="print-area flex min-w-0 flex-1 flex-col p-4">
      <PrintPreview
        :sheets="sheets"
        :labels="library.labels.value"
        :fit-for="autoFit.fitFor"
        :brand="settings.brand()"
        :show-ruler="settings.state.showRuler"
        :label-style="settings.state.labelStyle"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, watchEffect } from 'vue'

import DiagnosticsPanel from '@/components/DiagnosticsPanel.vue'
import ImportDropZone from '@/components/ImportDropZone.vue'
import LabelPicker from '@/components/LabelPicker.vue'
import PrintPreview from '@/components/PrintPreview.vue'
import SheetStartPicker from '@/components/SheetStartPicker.vue'
import StyleSettings from '@/components/StyleSettings.vue'
import { createAutoFit } from '@/composables/use-auto-fit'
import { library } from '@/composables/use-library'
import { selection } from '@/composables/use-selection'
import { settings } from '@/composables/use-settings'
import { createDomMeasurer, type DomMeasurer } from '@/infra/dom-measurer'

// The measuring sandbox needs a document, so it is built on first use rather
// than at module load.
let measurer: DomMeasurer | null = null
const autoFit = createAutoFit((input) => {
  measurer ??= createDomMeasurer()
  return measurer.measure(input)
})

const sheets = computed(() => selection.planFor(library.labels.value))

const selectedLabels = computed(() => library.labels.value.filter((label) => selection.isSelected(label.id)))

/**
 * Keep the rendered labels measured at all times.
 *
 * Deliberately not tied to the print button: `beforeprint` cannot await
 * anything, so pressing Cmd+P directly has to find a DOM that is already right.
 */
watchEffect(() => autoFit.ensureMeasured(selectedLabels.value, settings.brand(), settings.state.labelStyle))

onMounted(() => {
  // Everything measured before the embedded face arrives used fallback metrics
  // and is therefore wrong; throw it away and measure again.
  void document.fonts?.ready.then(() => {
    autoFit.invalidate()
    autoFit.ensureMeasured(selectedLabels.value, settings.brand(), settings.state.labelStyle)
  })
})

onBeforeUnmount(() => measurer?.dispose())

async function handleFile(file: File): Promise<void> {
  await library.importFile(file)
  selection.applyDefaults(library.labels.value)
}

async function print(): Promise<void> {
  await document.fonts?.ready
  autoFit.ensureMeasured(selectedLabels.value, settings.brand(), settings.state.labelStyle)
  await nextTick()
  // Two frames: one for Vue's DOM patch to land, one for layout to settle with
  // the final font sizes.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  window.print()
}
</script>
