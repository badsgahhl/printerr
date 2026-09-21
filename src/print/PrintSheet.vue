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

    <!--
      One line per inner division. The outer edges are the edges of the paper and
      need no mark -- which is just as well, since that is the strip a printer
      cannot reach.
    -->
    <div class="sheet__cuts" aria-hidden="true">
      <span
        v-for="column in grid.columns - 1"
        :key="`v${column}`"
        class="sheet__cut sheet__cut--v"
        :style="{ left: `calc(var(--label-w) * ${column})` }"
      />
      <span
        v-for="row in grid.rows - 1"
        :key="`h${row}`"
        class="sheet__cut sheet__cut--h"
        :style="{ top: `calc(var(--label-h) * ${row})` }"
      />
    </div>

    <div v-if="showRuler" class="sheet__ruler" aria-hidden="true" />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { SheetPlan, Slot } from '@/lib/paginate'
import { DEFAULT_LABEL_STYLE, gridOf, type LabelStyle, sheetCssVars } from '@/print/geometry'

const props = defineProps<{
  sheet: SheetPlan
  /** Draws the calibration ruler; only ever wanted on the first sheet. */
  showRuler?: boolean
  labelStyle?: LabelStyle
}>()

const style = computed(() => sheetCssVars(props.labelStyle ?? DEFAULT_LABEL_STYLE))
const grid = computed(() => gridOf(props.labelStyle ?? DEFAULT_LABEL_STYLE))

const isBlocked = (cell: Slot): boolean => cell.kind === 'empty' && cell.reason === 'blocked'
</script>
