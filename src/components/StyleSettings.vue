<template>
  <section class="border-rule rounded-lg border">
    <header class="flex items-center justify-between px-3 py-2">
      <button type="button" class="text-ink flex-1 text-left text-sm font-medium" @click="expanded = !expanded">
        Schildgröße
        <span class="text-ink-soft font-normal">{{ expanded ? '▾' : '▸' }}</span>
      </button>
      <button v-if="!isDefault" type="button" class="text-ink-soft text-xs underline" @click="$emit('reset')">
        zurücksetzen
      </button>
    </header>

    <div v-if="expanded" class="flex flex-col gap-3 px-3 pb-3">
      <p class="text-ink-soft text-xs">
        Alle Größen sind Obergrenzen — passt der Text nicht, wird er automatisch weiter verkleinert.
      </p>

      <label v-for="slider in SLIDERS" :key="slider.key" class="block">
        <span class="text-ink flex justify-between text-xs">
          <span>{{ slider.label }}</span>
          <span class="text-ink-soft tabular-nums">{{ display(slider) }}</span>
        </span>
        <input
          type="range"
          class="w-full"
          :min="STYLE_LIMITS[slider.key].min"
          :max="STYLE_LIMITS[slider.key].max"
          :step="STYLE_LIMITS[slider.key].step"
          :value="labelStyle[slider.key]"
          @input="$emit('change', slider.key, Number(($event.target as HTMLInputElement).value))"
        />
      </label>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import { type LabelStyle, pxToMm, STYLE_LIMITS } from '@/print/geometry'

interface Slider {
  readonly key: keyof LabelStyle
  readonly label: string
  /** Font sizes are shown in millimetres; a seller thinks in paper, not pixels. */
  readonly unit: 'mm-from-px' | 'mm'
}

const SLIDERS: readonly Slider[] = [
  { key: 'priceMaxPx', label: 'Preis', unit: 'mm-from-px' },
  { key: 'nameMaxPx', label: 'Produktname', unit: 'mm-from-px' },
  { key: 'detailMaxPx', label: 'Kleintext (Hersteller, Zusätze, Fuß)', unit: 'mm-from-px' },
  { key: 'paddingMm', label: 'Rand', unit: 'mm' }
]

const props = defineProps<{ labelStyle: LabelStyle; isDefault: boolean }>()

defineEmits<{ change: [keyof LabelStyle, number]; reset: [] }>()

const expanded = ref(false)

function display(slider: Slider): string {
  const value = props.labelStyle[slider.key]
  const mm = slider.unit === 'mm' ? value : pxToMm(value)
  return `${mm.toFixed(1).replace('.', ',')} mm`
}
</script>
