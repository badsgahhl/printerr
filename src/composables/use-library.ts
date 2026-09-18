import { ref, shallowRef } from 'vue'

import { createSafeStorage, type SafeStorage } from '@/infra/safe-storage'
import { readOds } from '@/lib/ods/read-ods'
import { buildLabels } from '@/lib/schema/build-labels'
import type { Diagnostic, Label } from '@/lib/types'

/**
 * The imported spreadsheet.
 *
 * A thin reactive shell: parsing and validation are pure functions in lib/, so
 * the interesting logic is testable without Vue. Exported as a factory plus a
 * default instance -- the app uses the singleton, tests build their own so state
 * cannot leak between them.
 */

export interface LibrarySource {
  readonly fileName: string
  readonly importedAt: string
}

export type LibraryStatus = 'idle' | 'parsing' | 'ready' | 'error'

/** Refuse to persist a library this large rather than blow the 5MB quota. */
const MAX_PERSIST_BYTES = 2_000_000

interface Persisted {
  readonly labels: readonly Label[]
  readonly diagnostics: readonly Diagnostic[]
  readonly source: LibrarySource | null
}

export function createLibrary(deps: { storage?: SafeStorage } = {}) {
  const storage = deps.storage ?? createSafeStorage()

  const labels = shallowRef<readonly Label[]>([])
  const diagnostics = ref<readonly Diagnostic[]>([])
  const source = ref<LibrarySource | null>(null)
  const status = ref<LibraryStatus>('idle')
  const persisted = ref(true)

  const restored = storage.read<Persisted | null>('library', null)
  if (restored?.labels?.length) {
    labels.value = restored.labels
    diagnostics.value = restored.diagnostics ?? []
    source.value = restored.source ?? null
    status.value = 'ready'
  }

  /**
   * Written explicitly on import rather than through a deep watcher: the library
   * only ever changes when a file is dropped, so watching hundreds of objects
   * for changes that never come would be pure overhead.
   */
  function persist(): void {
    const payload: Persisted = {
      labels: labels.value,
      diagnostics: diagnostics.value,
      source: source.value
    }
    const encoded = JSON.stringify(payload)
    if (encoded.length > MAX_PERSIST_BYTES) {
      persisted.value = false
      return
    }
    persisted.value = storage.write('library', payload)
  }

  async function importFile(file: File): Promise<void> {
    status.value = 'parsing'
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const read = readOds(bytes)
      const built = buildLabels(read.sheets)

      labels.value = built.labels
      diagnostics.value = [...read.diagnostics, ...built.diagnostics]
      source.value = { fileName: file.name, importedAt: new Date().toISOString() }
      status.value = built.labels.length > 0 ? 'ready' : 'error'
      persist()
    } catch (error) {
      labels.value = []
      source.value = { fileName: file.name, importedAt: new Date().toISOString() }
      diagnostics.value = [
        {
          severity: 'error',
          code: 'missing-sheet',
          sheet: null,
          row: null,
          column: null,
          labelId: null,
          message: `Die Datei „${file.name}" konnte nicht gelesen werden: ${(error as Error).message}`
        }
      ]
      status.value = 'error'
    }
  }

  function clear(): void {
    labels.value = []
    diagnostics.value = []
    source.value = null
    status.value = 'idle'
    storage.remove('library')
  }

  return {
    labels,
    diagnostics,
    source,
    status,
    /** False when the import could not be saved and will be gone after a reload. */
    persisted,
    storagePersistent: storage.persistent,
    importFile,
    clear
  }
}

export type LibraryStore = ReturnType<typeof createLibrary>

export const library = createLibrary()
