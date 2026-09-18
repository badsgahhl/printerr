<template>
  <section class="border-rule flex min-h-0 flex-col rounded-lg border">
    <header class="border-rule flex flex-wrap items-center gap-2 border-b px-3 py-2">
      <input
        v-model="query"
        type="search"
        placeholder="Suchen (Name, Artikelnummer)"
        class="border-rule min-w-40 flex-1 rounded border px-2 py-1 text-sm"
      />
      <button type="button" class="text-ink-soft text-xs underline" @click="$emit('selectAll')">alle</button>
      <button type="button" class="text-ink-soft text-xs underline" @click="$emit('clear')">keine</button>
    </header>

    <p v-if="visible.length === 0" class="text-ink-soft px-3 py-6 text-center text-sm">
      {{ labels.length === 0 ? 'Noch keine Tabelle geladen.' : 'Nichts gefunden.' }}
    </p>

    <ul v-else class="divide-rule min-h-0 flex-1 divide-y overflow-y-auto">
      <li v-for="label in visible" :key="label.id" class="flex items-center gap-3 px-3 py-2">
        <input
          :id="`pick-${label.id}`"
          type="checkbox"
          class="size-4 shrink-0"
          :checked="isSelected(label.id)"
          @change="$emit('toggle', label.id, label.copies)"
        />

        <label :for="`pick-${label.id}`" class="min-w-0 flex-1 cursor-pointer">
          <span class="text-ink block truncate text-sm">{{ label.name }}</span>
          <span class="text-ink-soft block truncate text-xs">
            <template v-if="label.artNr">Art. {{ label.artNr }} · </template>
            {{ priceTextOf(label) }}
            <template v-if="label.extras.length > 0"> · {{ label.extras.length }} Zusätze</template>
          </span>
        </label>

        <span
          v-if="overflowing.has(label.id)"
          class="shrink-0 text-xs text-amber-700"
          title="Der Text passt nicht vollständig auf das Schild."
          >gekürzt</span
        >

        <input
          type="number"
          min="0"
          step="1"
          class="border-rule w-14 shrink-0 rounded border px-1 py-0.5 text-right text-sm"
          :value="copiesOf(label.id)"
          aria-label="Anzahl"
          @input="$emit('setCopies', label.id, Number(($event.target as HTMLInputElement).value))"
        />
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { computePriceView } from '@/lib/price'
import type { Label } from '@/lib/types'

const props = defineProps<{
  labels: readonly Label[]
  isSelected: (id: string) => boolean
  copiesOf: (id: string) => number
  overflowing: ReadonlySet<string>
}>()

defineEmits<{
  toggle: [string, number]
  setCopies: [string, number]
  selectAll: []
  clear: []
}>()

const query = ref('')

const visible = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (needle.length === 0) return props.labels
  return props.labels.filter((label) =>
    [label.name, label.artNr, label.subtitle, label.id]
      .filter((field) => field !== null)
      .some((field) => field.toLowerCase().includes(needle))
  )
})

/** The price as the label will print it, so the list matches the paper. */
const priceTextOf = (label: Label): string => {
  const view = computePriceView(label)
  return view.suffix === null ? view.mainText : `${view.mainText} (${view.suffix})`
}
</script>
