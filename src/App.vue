<template>
  <div class="app-shell bg-muted/40 flex h-screen flex-col">
    <header class="app-chrome bg-background flex items-center gap-4 border-b px-4 py-2">
      <h1 class="text-base font-semibold">Preisschilder</h1>

      <Tabs :model-value="mode" @update:model-value="(value) => (mode = value as Mode)">
        <TabsList>
          <TabsTrigger value="print">
            <Printer class="mr-1.5 size-4" />
            Drucken
          </TabsTrigger>
          <TabsTrigger value="data">
            <Table2 class="mr-1.5 size-4" />
            Daten
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <span class="text-muted-foreground ml-auto text-xs">
        {{ catalogState.products.value.length }} Produkte · {{ catalogState.parts.value.length }} Teile
      </span>
    </header>

    <p v-if="!catalogState.ready.value" class="text-muted-foreground p-8 text-center text-sm">Daten werden geladen …</p>

    <!-- v-show, not v-if: switching to the data tab must not throw away the
         measured label sizes, and print.css brings the print view back for the
         printout whichever tab happens to be open. -->
    <PrintWorkspace v-show="mode === 'print'" :labels="catalogState.labels.value" />
    <DataWorkspace v-show="mode === 'data'" />
  </div>
</template>

<script setup lang="ts">
import { Printer, Table2 } from '@lucide/vue'
import { useStorage } from '@vueuse/core'
import { computed, onMounted } from 'vue'

import DataWorkspace from '@/components/data/DataWorkspace.vue'
import PrintWorkspace from '@/components/PrintWorkspace.vue'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { catalogState } from '@/composables/use-catalog'
import { selection } from '@/composables/use-selection'
import { KEY_PREFIX } from '@/infra/safe-storage'

type Mode = 'print' | 'data'

const storedMode = useStorage<string>(`${KEY_PREFIX}mode`, 'print')

/**
 * Guard the stored tab against anything that is not a mode we know.
 *
 * Both workspaces are toggled with v-show, so an unrecognised value hides both
 * and leaves an empty window with no way back. Storage is shared across every
 * local file in Chrome and survives versions of this app, so it cannot be
 * trusted to hold only what we last wrote.
 */
const mode = computed<Mode>({
  get: () => (storedMode.value === 'data' ? 'data' : 'print'),
  set: (value) => void (storedMode.value = value)
})

onMounted(async () => {
  await catalogState.init()
  // A fresh browser has no selection yet; fall back to what the data says should
  // be printed. An existing selection is left alone -- it is the seller's.
  if (selection.selectedCount.value === 0) selection.applyDefaults(catalogState.labels.value)
})
</script>
