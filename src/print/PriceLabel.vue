<template>
  <article class="label" :style="style">
    <header class="label__head">
      <div class="label__name">{{ label.name }}</div>
      <div v-if="label.subtitle" class="label__subtitle">{{ label.subtitle }}</div>
      <div v-if="label.artNr" class="label__artnr">Art. {{ label.artNr }}</div>
    </header>

    <div class="label__price">
      <div class="label__price-main">{{ price.mainText }}</div>
      <div v-if="price.suffix" class="label__price-suffix">{{ price.suffix }}</div>
    </div>

    <div v-if="price.breakdown.length > 0" class="label__breakdown">
      <div v-for="(row, index) in price.breakdown" :key="index" class="label__row">
        <span class="label__row-label">{{ row.label }}</span>
        <span v-if="hasBreakdownArtNr" class="label__row-artnr">{{ row.artNr ? `Art. ${row.artNr}` : '' }}</span>
        <span class="label__row-amount">{{ row.amountText }}</span>
      </div>
    </div>

    <footer class="label__foot">
      <div v-if="label.note" class="label__note">{{ label.note }}</div>
      <div v-if="brand" class="label__brand">{{ brand }}</div>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { computePriceView } from '@/lib/price'
import type { Label } from '@/lib/types'
import { DEFAULT_LABEL_STYLE, FONT_SIZE_VARS, type LabelStyle, labelCssVars, type StyleKey } from '@/print/geometry'

const props = defineProps<{
  label: Label
  /**
   * Fitted font sizes in pixels, keyed by style. Optional: without it the
   * stylesheet falls back to its defaults, so a label still renders correctly
   * before measuring has run.
   */
  fit?: Partial<Record<StyleKey, number>>
  /** Shop name printed at the foot; null hides it. */
  brand?: string | null
  /** Size and margin settings; the defaults are what the shop starts with. */
  labelStyle?: LabelStyle
}>()

const price = computed(() => computePriceView(props.label))

const hasBreakdownArtNr = computed(() => price.value.breakdown.some((row) => row.artNr !== null))

const style = computed<Record<string, string>>(() => {
  const vars = labelCssVars(
    price.value.breakdown.length,
    hasBreakdownArtNr.value,
    props.labelStyle ?? DEFAULT_LABEL_STYLE
  )
  for (const [key, cssVar] of Object.entries(FONT_SIZE_VARS) as [StyleKey, string][]) {
    const size = props.fit?.[key]
    if (size !== undefined) vars[cssVar] = `${size}px`
  }
  return vars
})
</script>
