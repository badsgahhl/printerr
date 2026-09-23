<template>
  <div class="print-workspace flex min-h-0 flex-1">
    <aside class="app-chrome bg-background flex w-96 shrink-0 flex-col gap-4 overflow-y-auto border-r p-4">
      <p v-if="labels.length === 0" class="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        Noch keine Produkte. Wechsle zu <strong>Daten</strong> und lege welche an — oder importiere dort eine
        LibreOffice-Tabelle.
      </p>

      <LabelPicker
        v-else
        class="min-h-64 flex-1"
        :labels="labels"
        :is-selected="selection.isSelected"
        :copies-of="selection.copiesOf"
        :overflowing="autoFit.overflowing.value"
        @toggle="selection.toggle"
        @set-copies="selection.setCopies"
        @select-all="selection.selectAll(labels)"
        @clear="selection.clearSelection()"
      />

      <SheetStartPicker
        :is-blocked="selection.isBlocked"
        :label-style="settings.state.labelStyle"
        @toggle="(slot) => selection.toggleBlockedSlot(slot, slots)"
      />

      <StyleSettings
        :label-style="settings.state.labelStyle"
        lade
        :is-default="settings.isStyleDefault"
        @change="settings.setStyle"
        @grid="settings.setGrid"
        @reset="settings.resetStyle"
      />

      <fieldset class="flex flex-col gap-2 text-sm">
        <legend class="text-sm font-medium">Schild-Fuß</legend>
        <label class="flex items-center gap-2">
          <Checkbox :model-value="settings.state.brandEnabled" @update:model-value="setBrandEnabled" />
          <span>Ladenname aufs Schild</span>
        </label>
        <Input
          v-model="settings.state.brandText"
          placeholder="Name des Geschäfts"
          :disabled="!settings.state.brandEnabled"
        />
        <label class="flex items-center gap-2">
          <Checkbox :model-value="settings.state.showRuler" @update:model-value="setShowRuler" />
          <span>Maßstab-Lineal mitdrucken</span>
        </label>
      </fieldset>

      <section class="rounded-lg border p-3 text-xs">
        <p class="font-medium">Vor dem Drucken im Dialog prüfen</p>
        <ul class="text-muted-foreground mt-1 list-disc pl-4">
          <li>
            Ränder: <strong>Keine</strong> — mit Rand passt ein Bogen nicht mehr auf eine Seite, und hinter jedem folgt
            eine fast leere
          </li>
          <li>Kopf- und Fußzeilen: <strong>aus</strong></li>
          <li>Skalierung: <strong>Standard</strong> (100 %)</li>
        </ul>
        <p class="text-muted-foreground mt-2">
          <strong>Hintergrundgrafiken</strong> müssen nicht angehakt werden: die Schnittlinien drucken so oder so.
        </p>
      </section>

      <Button :disabled="sheets.length === 0" @click="print">
        {{
          sheets.length === 0
            ? 'Nichts ausgewählt'
            : `${selection.labelCount.value} Schilder auf ${sheets.length} Bogen drucken`
        }}
      </Button>
    </aside>

    <main class="print-area flex min-w-0 flex-1 flex-col p-4">
      <PrintPreview
        :sheets="sheets"
        :labels="labels"
        :fit-for="autoFit.fitFor"
        :brand="settings.brand()"
        :show-ruler="settings.state.showRuler"
        :label-style="settings.state.labelStyle"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, onMounted, watch, watchEffect } from 'vue'

import LabelPicker from '@/components/LabelPicker.vue'
import PrintPreview from '@/components/PrintPreview.vue'
import SheetStartPicker from '@/components/SheetStartPicker.vue'
import StyleSettings from '@/components/StyleSettings.vue'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { createAutoFit } from '@/composables/use-auto-fit'
import { selection } from '@/composables/use-selection'
import { settings } from '@/composables/use-settings'
import { createDomMeasurer, type DomMeasurer } from '@/infra/dom-measurer'
import type { Label } from '@/lib/types'
import { slotsPerSheet } from '@/print/geometry'

const props = defineProps<{ labels: readonly Label[] }>()

// The measuring sandbox needs a document, so it is built on first use rather
// than at module load.
let measurer: DomMeasurer | null = null
const autoFit = createAutoFit((input) => {
  measurer ??= createDomMeasurer()
  return measurer.measure(input)
})

const slots = computed(() => slotsPerSheet(settings.state.labelStyle))
const sheets = computed(() => selection.planFor(props.labels, slots.value))

// A smaller grid has fewer slots than the one that was blocked before.
watch(slots, (count) => selection.pruneBlockedSlots(count))
const selectedLabels = computed(() => props.labels.filter((label) => selection.isSelected(label.id)))

const setBrandEnabled = (value: boolean | 'indeterminate') => void (settings.state.brandEnabled = value === true)
const setShowRuler = (value: boolean | 'indeterminate') => void (settings.state.showRuler = value === true)

/**
 * Keep the rendered labels measured at all times.
 *
 * Deliberately not tied to the print button: `beforeprint` cannot await
 * anything, so pressing Cmd+P directly has to find a DOM that is already right.
 */
watchEffect(() => autoFit.ensureMeasured(selectedLabels.value, settings.brand(), settings.state.labelStyle))

/** Throw every measurement away and take them again. */
function remeasure(): void {
  autoFit.invalidate()
  autoFit.ensureMeasured(selectedLabels.value, settings.brand(), settings.state.labelStyle)
}

// Everything measured before the embedded face arrives used fallback metrics and
// is therefore wrong; throw it away and measure again. `fonts.ready` alone is not
// enough: it resolves as soon as nothing is loading, which can be before the label
// face was ever asked for -- the first measurement then asks for it and gets the
// fallback's widths. So every face that finishes loading counts.
useEventListener(document.fonts, 'loadingdone', remeasure)
onMounted(() => void document.fonts?.ready.then(remeasure))

onBeforeUnmount(() => measurer?.dispose())

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
