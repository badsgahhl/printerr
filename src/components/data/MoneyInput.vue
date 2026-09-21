<template>
  <Input
    :model-value="text"
    :placeholder="placeholder"
    inputmode="decimal"
    :aria-invalid="invalid || undefined"
    @update:model-value="onInput"
    @blur="normalize"
  />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import { Input } from '@/components/ui/input'
import { formatCents } from '@/lib/price'
import { parseCents } from '@/lib/schema/parse-number'

/**
 * Money entry that keeps its own text while being typed.
 *
 * Reformatting on every keystroke would fight the person typing -- "12," would
 * jump to "12,00" before they reach the cents. The value is parsed as they go so
 * the form stays live, and only tidied up on blur.
 */

const props = withDefaults(
  defineProps<{
    /** Amount in cents, or null when the field may be left empty. */
    modelValue: number | null
    placeholder?: string
    allowEmpty?: boolean
  }>(),
  { placeholder: '0,00', allowEmpty: false }
)

const emit = defineEmits<{ 'update:modelValue': [number | null] }>()

const asText = (cents: number | null): string =>
  cents === null
    ? ''
    : formatCents(cents)
        .replace(/\s*€$/u, '')
        .trim()

const text = ref(asText(props.modelValue))
const invalid = ref(false)

// Follow the value when it changes from outside, but never while the field is
// mid-edit and already in agreement.
watch(
  () => props.modelValue,
  (next) => {
    const parsed = parseCents(text.value)
    const current = parsed.ok ? parsed.value : null
    if (current !== next) text.value = asText(next)
  }
)

function onInput(value: string | number): void {
  text.value = String(value)
  const parsed = parseCents(text.value)

  if (parsed.ok) {
    invalid.value = false
    emit('update:modelValue', parsed.value)
    return
  }
  if (parsed.reason === 'empty') {
    invalid.value = false
    emit('update:modelValue', props.allowEmpty ? null : 0)
    return
  }
  invalid.value = true
}

function normalize(): void {
  const parsed = parseCents(text.value)
  if (parsed.ok) {
    text.value = asText(parsed.value)
    invalid.value = false
  } else if (parsed.reason === 'empty') {
    text.value = props.allowEmpty ? '' : asText(0)
    invalid.value = false
  }
}
</script>
