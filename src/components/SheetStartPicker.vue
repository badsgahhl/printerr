<template>
  <div>
    <p class="text-ink text-sm font-medium">Angebrochener Bogen</p>
    <p class="text-ink-soft mt-0.5 mb-2 text-xs">
      Bereits herausgeschnittene Plätze antippen — sie bleiben beim Drucken frei.
    </p>

    <div class="grid w-24 grid-cols-2 gap-1" role="group" aria-label="Belegte Plätze auf dem ersten Bogen">
      <button
        v-for="slot in SLOTS_PER_SHEET"
        :key="slot"
        type="button"
        class="border-rule aspect-[105/148.5] rounded-sm border text-xs"
        :class="isBlocked(slot - 1) ? 'bg-ink/15 text-ink-soft line-through' : 'bg-white'"
        :aria-pressed="isBlocked(slot - 1)"
        @click="$emit('toggle', slot - 1)"
      >
        {{ slot }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SLOTS_PER_SHEET } from '@/lib/paginate'

defineProps<{ isBlocked: (slot: number) => boolean }>()
defineEmits<{ toggle: [number] }>()
</script>
