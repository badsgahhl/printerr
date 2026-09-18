/**
 * Browser storage that cannot take the app down with it.
 *
 * Two things bite when the built file is opened by double-click:
 *  - Firefox throws a SecurityError on `file://` origins, and it throws on
 *    *reading the property*, not on setItem -- so the access itself is guarded.
 *  - Chrome refuses IndexedDB on file:// entirely, which is why this is
 *    localStorage and not something roomier. It is enough: a few hundred labels
 *    are well under 150KB against a 5MB quota.
 *
 * Chrome also gives every local file the same origin, hence the long key prefix.
 */

export const KEY_PREFIX = 'printerr:v1:'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface SafeStorage {
  /** False when values live only in memory and will not survive a reload. */
  readonly persistent: boolean
  read<T>(key: string, fallback: T): T
  write(key: string, value: unknown): boolean
  remove(key: string): void
}

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key)
  }
}

/** Probe with a real write: some browsers allow the read and refuse the write. */
export function detectStorage(): StorageLike | null {
  try {
    const storage = globalThis.localStorage
    if (!storage) return null
    const probe = `${KEY_PREFIX}probe`
    storage.setItem(probe, '1')
    storage.removeItem(probe)
    return storage
  } catch {
    return null
  }
}

export function createSafeStorage(detect: () => StorageLike | null = detectStorage): SafeStorage {
  // Guarded even though detectStorage catches internally: a caller-supplied
  // detector must not be able to take the whole app down, and this is exactly
  // where Firefox throws on file:// origins.
  let detected: StorageLike | null = null
  try {
    detected = detect()
  } catch {
    detected = null
  }

  const backing = detected ?? createMemoryStorage()

  return {
    persistent: detected !== null,

    read<T>(key: string, fallback: T): T {
      try {
        const raw = backing.getItem(KEY_PREFIX + key)
        if (raw === null) return fallback
        return JSON.parse(raw) as T
      } catch {
        // Corrupt or half-written JSON is not worth a crash; the seller can
        // simply drop the file in again.
        return fallback
      }
    },

    write(key: string, value: unknown): boolean {
      try {
        backing.setItem(KEY_PREFIX + key, JSON.stringify(value))
        return true
      } catch {
        // Quota exceeded, or a private window that allows reads but not writes.
        return false
      }
    },

    remove(key: string): void {
      try {
        backing.removeItem(KEY_PREFIX + key)
      } catch {
        // Nothing sensible to do, and nothing depends on it having worked.
      }
    }
  }
}
