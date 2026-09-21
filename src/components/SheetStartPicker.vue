<template>
  <div>
    <p class="text-sm font-medium">Angebrochener Bogen</p>
    <p class="text-muted-foreground mt-0.5 mb-2 text-xs">
      Bereits herausgeschnittene Plätze antippen — sie bleiben beim Drucken frei.
    </p>

    <div
      class="grid gap-1"
      :style="{ gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))`, width: `${gridWidthRem}rem` }"
      role="group"
      aria-label="Belegte Plätze auf dem ersten Bogen"
    >
      <button
        v-for="slot in slotCount"
        :key="slot"
        type="button"
        class="rounded-sm border text-xs"
        :style="{ aspectRatio: `${labelWidth} / ${labelHeight}` }"
        :class="isBlocked(slot - 1) ? 'bg-foreground/15 text-muted-foreground line-through' : 'bg-background'"
        :aria-pressed="isBlocked(slot - 1)"
        @click="$emit('toggle', slot - 1)"
      >
        {{ slot }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { DEFAULT_LABEL_STYLE, gridOf, type LabelStyle, labelHeightMm, labelWidthMm } from '@/print/geometry'

const props = defineProps<{ isBlocked: (slot: number) => boolean; labelStyle?: LabelStyle }>()

defineEmits<{ toggle: [number] }>()

const style = computed(() => props.labelStyle ?? DEFAULT_LABEL_STYLE)
const grid = computed(() => gridOf(style.value))
const slotCount = computed(() => grid.value.columns * grid.value.rows)
const labelWidth = computed(() => labelWidthMm(style.value))
const labelHeight = computed(() => labelHeightMm(style.value))

/** Keep the whole picker a constant size, so the sidebar does not jump about. */
const gridWidthRem = computed(() => Math.min(9, 3 + grid.value.columns * 1.5))
</script>
