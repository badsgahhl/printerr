import { describe, expect, it, vi } from 'vitest'

import { createSafeStorage, KEY_PREFIX, type StorageLike } from '@/infra/safe-storage'

function fakeStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key)
  }
}

describe('safe storage when the browser cooperates', () => {
  it('round-trips a value', () => {
    const storage = createSafeStorage(() => fakeStorage())

    expect(storage.write('selection', { ids: ['A'] })).toBe(true)
    expect(storage.read('selection', null)).toEqual({ ids: ['A'] })
    expect(storage.persistent).toBe(true)
  })

  it('namespaces keys, because Chrome shares one origin across all local files', () => {
    const backing = fakeStorage()
    createSafeStorage(() => backing).write('settings', 1)

    expect([...backing.map.keys()]).toEqual([`${KEY_PREFIX}settings`])
  })

  it('returns the fallback for a key that was never written', () => {
    expect(createSafeStorage(() => fakeStorage()).read('missing', 'default')).toBe('default')
  })

  it('removes a value', () => {
    const storage = createSafeStorage(() => fakeStorage())
    storage.write('a', 1)
    storage.remove('a')

    expect(storage.read('a', 'gone')).toBe('gone')
  })
})

describe('safe storage when the browser refuses', () => {
  it('falls back to memory when storage is unavailable', () => {
    // Firefox throws a SecurityError on file:// origins -- on the property
    // access itself, which is why detection is wrapped rather than just setItem.
    const storage = createSafeStorage(() => null)

    expect(storage.persistent).toBe(false)
    expect(storage.write('a', 42)).toBe(true)
    expect(storage.read('a', 0)).toBe(42)
  })

  it('reports a failed write instead of throwing', () => {
    const failing: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {}
    }

    expect(createSafeStorage(() => failing).write('a', 1)).toBe(false)
  })

  it('survives a value that is not valid JSON', () => {
    const corrupt: StorageLike = {
      getItem: () => '{not json',
      setItem: () => {},
      removeItem: () => {}
    }

    expect(createSafeStorage(() => corrupt).read('a', 'fallback')).toBe('fallback')
  })

  it('ignores a removeItem that throws', () => {
    const failing: StorageLike = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {
        throw new Error('nope')
      }
    }

    expect(() => createSafeStorage(() => failing).remove('a')).not.toThrow()
  })

  it('treats a throwing detector as no storage at all', () => {
    const detect = vi.fn<() => StorageLike | null>(() => {
      throw new Error('SecurityError')
    })
    const storage = createSafeStorage(detect)

    expect(detect).toHaveBeenCalled()
    expect(storage.persistent).toBe(false)
    expect(storage.write('a', 1)).toBe(true)
    expect(storage.read('a', 0)).toBe(1)
  })
})
