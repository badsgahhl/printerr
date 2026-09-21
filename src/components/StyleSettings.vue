<template>
  <section class="rounded-lg border">
    <header class="flex items-center justify-between px-3 py-2">
      <button type="button" class="flex-1 text-left text-sm font-medium" @click="expanded = !expanded">
        Bogen &amp; Schildgröße
        <span class="text-muted-foreground font-normal">{{ expanded ? '▾' : '▸' }}</span>
      </button>
      <span class="text-muted-foreground mr-2 text-xs tabular-nums">{{ formatSummary }}</span>
      <button v-if="!isDefault" type="button" class="text-muted-foreground text-xs underline" @click="$emit('reset')">
        zurücksetzen
      </button>
    </header>

    <div v-if="expanded" class="flex flex-col gap-4 px-3 pb-3">
      <div class="flex flex-col gap-1.5">
        <span class="text-xs font-medium">Schilder pro Bogen</span>
        <div class="grid grid-cols-4 gap-1">
          <button
            v-for="preset in GRID_PRESETS"
            :key="preset.label"
            type="button"
            class="rounded-md border px-1 py-1.5 text-center text-xs"
            :class="isActive(preset.grid) ? 'border-foreground bg-accent font-medium' : 'hover:bg-accent/50'"
            :title="preset.note"
            @click="$emit('grid', preset.grid)"
          >
            {{ preset.grid.columns * preset.grid.rows }}
          </button>
        </div>

        <div class="text-muted-foreground flex items-center gap-1.5 pt-1 text-xs">
          <span>oder</span>
          <input
            type="number"
            class="border-input h-7 w-12 rounded-md border bg-transparent px-1.5 text-center"
            :min="STYLE_LIMITS.columns.min"
            :max="STYLE_LIMITS.columns.max"
            :value="grid.columns"
            aria-label="Spalten"
            @input="emitGrid('columns', $event)"
          />
          <span>×</span>
          <input
            type="number"
            class="border-input h-7 w-12 rounded-md border bg-transparent px-1.5 text-center"
            :min="STYLE_LIMITS.rows.min"
            :max="STYLE_LIMITS.rows.max"
            :value="grid.rows"
            aria-label="Zeilen"
            @input="emitGrid('rows', $event)"
          />
          <span class="tabular-nums">= {{ labelSize }}</span>
        </div>

        <p v-if="marginTooTight" class="text-xs text-amber-700">
          Rand {{ round(effectivePadding) }} mm: Drucker erreichen die äußeren 3–6 mm eines Blattes nicht. Die Schilder
          am Blattrand können beschnitten werden — notfalls den Rand-Regler erhöhen.
        </p>
      </div>

      <div class="flex flex-col gap-3 border-t pt-3">
        <p class="text-muted-foreground text-xs">
          Alle Größen sind Obergrenzen — passt der Text nicht, wird er automatisch weiter verkleinert. Sie gelten für
          ein Viertel-A4 und werden auf das gewählte Format umgerechnet.
        </p>

        <label v-for="slider in SLIDERS" :key="slider.key" class="block">
          <span class="flex justify-between text-xs">
            <span>{{ slider.label }}</span>
            <span class="text-muted-foreground tabular-nums">{{ display(slider) }}</span>
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
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  fontRanges,
  GRID_PRESETS,
  gridOf,
  type LabelStyle,
  labelHeightMm,
  labelWidthMm,
  paddingMm,
  pxToMm,
  SAFE_PADDING_MM,
  type SheetGrid,
  type StyleKey,
  STYLE_LIMITS
} from '@/print/geometry'

interface Slider {
  readonly key: 'priceMaxPx' | 'nameMaxPx' | 'detailMaxPx' | 'paddingMm'
  readonly label: string
  /** Which font range to read the effective size from; absent for the margin. */
  readonly styleKey?: StyleKey
}

const SLIDERS: readonly Slider[] = [
  { key: 'priceMaxPx', label: 'Preis', styleKey: 'price' },
  { key: 'nameMaxPx', label: 'Produktname', styleKey: 'name' },
  { key: 'detailMaxPx', label: 'Kleintext (Hersteller, Zusätze, Fuß)', styleKey: 'breakdownLabel' },
  { key: 'paddingMm', label: 'Rand' }
]

const props = defineProps<{ labelStyle: LabelStyle; isDefault: boolean }>()

const emit = defineEmits<{ change: [keyof LabelStyle, number]; grid: [SheetGrid]; reset: [] }>()

const expanded = ref(false)

const grid = computed(() => gridOf(props.labelStyle))
const round = (value: number): string => value.toFixed(value % 1 === 0 ? 0 : 1).replace('.', ',')

const labelSize = computed(
  () => `${round(labelWidthMm(props.labelStyle))} × ${round(labelHeightMm(props.labelStyle))} mm`
)

// A middle dot, not another times sign: "12 × 70 × 74,3 mm" reads as one sum.
const formatSummary = computed(() => `${grid.value.columns * grid.value.rows} · ${labelSize.value}`)

const effectivePadding = computed(() => paddingMm(props.labelStyle))
const marginTooTight = computed(() => effectivePadding.value < SAFE_PADDING_MM)

const isActive = (candidate: SheetGrid): boolean =>
  candidate.columns === grid.value.columns && candidate.rows === grid.value.rows

function emitGrid(axis: 'columns' | 'rows', event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  emit('grid', { ...grid.value, [axis]: value })
}

/**
 * Show what the setting actually produces on the chosen format.
 *
 * The stored value is stated for a quarter of A4; at nine labels a sheet the
 * same number means something much smaller, and a slider that kept claiming
 * 29mm would simply be lying.
 */
function display(slider: Slider): string {
  if (!slider.styleKey) return `${round(paddingMm(props.labelStyle))} mm`
  return `${round(pxToMm(fontRanges(props.labelStyle)[slider.styleKey].maxPx))} mm`
}
</script>
