<template>
  <section v-if="diagnostics.length > 0" class="border-rule rounded-lg border">
    <header class="border-rule flex items-center justify-between border-b px-3 py-2">
      <h2 class="text-ink text-sm font-semibold">
        {{ errorCount > 0 ? `${errorCount} Fehler` : '' }}
        {{ errorCount > 0 && warningCount > 0 ? ' · ' : '' }}
        {{ warningCount > 0 ? `${warningCount} Hinweise` : '' }}
      </h2>
      <button type="button" class="text-ink-soft text-xs underline" @click="expanded = !expanded">
        {{ expanded ? 'einklappen' : 'anzeigen' }}
      </button>
    </header>

    <ul v-if="expanded" class="divide-rule max-h-64 divide-y overflow-y-auto text-sm">
      <li v-for="(diagnostic, index) in diagnostics" :key="index" class="flex gap-2 px-3 py-2">
        <span
          class="mt-0.5 shrink-0 font-mono text-xs"
          :class="diagnostic.severity === 'error' ? 'text-red-700' : 'text-amber-700'"
        >
          {{ diagnostic.severity === 'error' ? 'Fehler' : 'Hinweis' }}
        </span>
        <span>
          <span class="text-ink">{{ diagnostic.message }}</span>
          <span v-if="location(diagnostic)" class="text-ink-soft"> ({{ location(diagnostic) }})</span>
        </span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Diagnostic } from '@/lib/types'

const props = defineProps<{ diagnostics: readonly Diagnostic[] }>()

const expanded = ref(true)

const errorCount = computed(() => props.diagnostics.filter((d) => d.severity === 'error').length)
const warningCount = computed(() => props.diagnostics.filter((d) => d.severity === 'warning').length)

/** Where to look in LibreOffice: sheet, row number, column heading. */
function location(diagnostic: Diagnostic): string {
  return [
    diagnostic.sheet === null ? null : `Blatt ${diagnostic.sheet}`,
    diagnostic.row === null ? null : `Zeile ${diagnostic.row}`,
    diagnostic.column === null ? null : `Spalte ${diagnostic.column}`
  ]
    .filter((part) => part !== null)
    .join(', ')
}
</script>
