/**
 * Browser storage that cannot take the app down with it.
 *
 * Reading `window.localStorage` can throw rather than merely return null -- a
 * private window, a profile with site data blocked, or a page opened straight
 * off disk in Firefox, which raises a SecurityError on the property access
 * itself. So the access is guarded, not just the write.
 *
 * The long key prefix stays for the same reason: opened from disk, every local
 * page in Chrome shares one origin and therefore one set of keys.
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
