<template>
  <div>
    <div class="flex items-baseline justify-between gap-2 text-xs">
      <label :for="id">{{ label }}</label>
      <span class="flex items-baseline gap-2">
        <button
          v-if="!isDefault"
          type="button"
          class="text-muted-foreground underline"
          :aria-label="`${label} auf Standard`"
          @click="$emit('reset')"
        >
          Standard
        </button>
        <span class="text-muted-foreground tabular-nums">{{ display }}</span>
      </span>
    </div>
    <input
      :id="id"
      type="range"
      class="w-full"
      :min="limits.min"
      :max="limits.max"
      :step="limits.step"
      :value="value"
      @input="$emit('change', Number(($event.target as HTMLInputElement).value))"
    />
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'

defineProps<{
  label: string
  value: number
  limits: { readonly min: number; readonly max: number; readonly step: number }
  /** What the value produces on the chosen format, which is not always the value itself. */
  display: string
  isDefault: boolean
}>()

defineEmits<{ change: [number]; reset: [] }>()

const id = useId()
</script>
