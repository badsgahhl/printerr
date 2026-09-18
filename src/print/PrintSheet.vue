<template>
  <section class="sheet" :style="style">
    <div class="sheet__grid">
      <div
        v-for="(cell, index) in sheet.slots"
        :key="index"
        class="sheet__slot"
        :class="{ 'sheet__slot--blocked': isBlocked(cell) }"
      >
        <slot v-if="cell.kind === 'label'" name="label" :label-id="cell.labelId" :copy-index="cell.copyIndex" />
      </div>
    </div>

    <div class="sheet__cuts" aria-hidden="true">
      <span class="sheet__cut sheet__cut--v" />
      <span class="sheet__cut sheet__cut--h" />
    </div>

    <div v-if="showRuler" class="sheet__ruler" aria-hidden="true" />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { SheetPlan, Slot } from '@/lib/paginate'
import { sheetCssVars } from '@/print/geometry'

defineProps<{
  sheet: SheetPlan
  /** Draws the calibration ruler; only ever wanted on the first sheet. */
  showRuler?: boolean
}>()

const style = computed(() => sheetCssVars())

const isBlocked = (cell: Slot): boolean => cell.kind === 'empty' && cell.reason === 'blocked'
</script>
