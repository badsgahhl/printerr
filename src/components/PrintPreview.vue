<template>
  <div ref="viewport" class="min-h-0 flex-1 overflow-auto">
    <p v-if="sheets.length === 0" class="text-ink-soft py-16 text-center text-sm">
      Noch nichts ausgewählt — links Schilder ankreuzen.
    </p>

    <div v-else class="sheet-list flex flex-col items-center gap-4 py-2">
      <div
        v-for="sheet in sheets"
        :key="sheet.index"
        class="sheet-scaler"
        :style="{ ...sheetCssVars(), '--preview-scale': String(scale) }"
      >
        <PrintSheet :sheet="sheet" :show-ruler="showRuler && sheet.index === 0">
          <template #label="{ labelId }">
            <PriceLabel
              v-if="labelFor(labelId)"
              :label="labelFor(labelId)!"
              :fit="fitFor(labelId)"
              :brand="brand"
              :label-style="labelStyle"
            />
          </template>
        </PrintSheet>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'

import type { LabelFit } from '@/composables/use-auto-fit'
import type { SheetPlan } from '@/lib/paginate'
import type { Label } from '@/lib/types'
import { type LabelStyle, mmToPx, SHEET_HEIGHT_MM, sheetCssVars, SHEET_WIDTH_MM } from '@/print/geometry'
import PriceLabel from '@/print/PriceLabel.vue'
import PrintSheet from '@/print/PrintSheet.vue'

const props = defineProps<{
  sheets: readonly SheetPlan[]
  labels: readonly Label[]
  fitFor: (labelId: string) => LabelFit | undefined
  brand: string | null
  showRuler: boolean
  labelStyle: LabelStyle
}>()

const viewport = useTemplateRef<HTMLElement>('viewport')
const { width, height } = useElementSize(viewport)

/**
 * Scale the sheet to the viewport with a CSS transform.
 *
 * A transform does not touch layout, so line breaks and rounding inside the
 * label are identical on screen and on paper -- which is what lets one set of
 * measured font sizes serve both. `zoom` would re-run layout and break that.
 */
const scale = computed(() => {
  const availableWidth = width.value - 32
  const availableHeight = height.value - 32
  if (availableWidth <= 0 || availableHeight <= 0) return 0.35

  // Fit a whole sheet, not just its width -- seeing one full page at a glance is
  // the point of the preview.
  const byWidth = availableWidth / mmToPx(SHEET_WIDTH_MM)
  const byHeight = availableHeight / mmToPx(SHEET_HEIGHT_MM)
  return Math.min(1, Math.max(0.12, Math.min(byWidth, byHeight)))
})

const byId = computed(() => new Map(props.labels.map((label) => [label.id, label])))

const labelFor = (labelId: string): Label | undefined => byId.value.get(labelId)
</script>
