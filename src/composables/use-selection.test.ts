import { describe, expect, it } from 'vitest'

import { createSelection } from '@/composables/use-selection'
import { createSafeStorage, type StorageLike } from '@/infra/safe-storage'
import type { Label } from '@/lib/types'

const label = (id: string, over: Partial<Label> = {}): Label => ({
  id,
  name: `Schild ${id}`,
  subtitle: null,
  artNr: null,
  priceCents: 1000,
  priceNote: null,
  note: null,
  copies: 1,
  preselected: true,
  layout: null,
  extras: [],
  sourceRow: 2,
  ...over
})

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key)
  }
}

const fresh = () => createSelection({ storage: createSafeStorage(() => memoryStorage()) })

describe('selection basics', () => {
  it('starts empty', () => {
    const selection = fresh()

    expect(selection.selectedCount.value).toBe(0)
    expect(selection.labelCount.value).toBe(0)
  })

  it('toggles a label on and off', () => {
    const selection = fresh()
    selection.toggle('A')
    expect(selection.isSelected('A')).toBe(true)

    selection.toggle('A')
    expect(selection.isSelected('A')).toBe(false)
  })

  it('counts labels rather than rows once copies are involved', () => {
    const selection = fresh()
    selection.setCopies('A', 3)
    selection.setCopies('B', 1)

    expect(selection.selectedCount.value).toBe(2)
    expect(selection.labelCount.value).toBe(4)
  })

  it('treats zero copies as deselected', () => {
    const selection = fresh()
    selection.setCopies('A', 2)
    selection.setCopies('A', 0)

    expect(selection.isSelected('A')).toBe(false)
  })

  it('refuses negative and fractional copy counts', () => {
    const selection = fresh()
    selection.setCopies('A', -5)
    expect(selection.isSelected('A')).toBe(false)

    selection.setCopies('B', 2.7)
    expect(selection.copiesOf('B')).toBe(2)
  })
})

describe('selection defaults from the spreadsheet', () => {
  it('applies the Drucken and Anzahl columns', () => {
    const selection = fresh()
    selection.applyDefaults([label('A', { copies: 2 }), label('B', { preselected: false }), label('C')])

    expect(selection.copiesOf('A')).toBe(2)
    expect(selection.isSelected('B')).toBe(false)
    expect(selection.copiesOf('C')).toBe(1)
  })

  it('replaces a previous selection instead of merging with it', () => {
    // A new file must not leave ids from the old one selected.
    const selection = fresh()
    selection.setCopies('OLD', 4)
    selection.applyDefaults([label('A')])

    expect(selection.isSelected('OLD')).toBe(false)
    expect(selection.isSelected('A')).toBe(true)
  })

  it('selects everything on demand without losing higher copy counts', () => {
    const selection = fresh()
    selection.setCopies('A', 5)
    selection.selectAll([label('A'), label('B')])

    expect(selection.copiesOf('A')).toBe(5)
    expect(selection.copiesOf('B')).toBe(1)
  })
})

describe('selection to sheets', () => {
  const labels = [label('A'), label('B'), label('C'), label('D'), label('E')]

  it('keeps the order of the spreadsheet', () => {
    const selection = fresh()
    selection.setCopies('C', 1)
    selection.setCopies('A', 1)

    expect(selection.jobsFor(labels).map((job) => job.labelId)).toEqual(['A', 'C'])
  })

  it('lays five labels onto two sheets', () => {
    const selection = fresh()
    selection.applyDefaults(labels)

    const plan = selection.planFor(labels)
    expect(plan).toHaveLength(2)
    expect(plan[1]?.slots.filter((slot) => slot.kind === 'label')).toHaveLength(1)
  })

  it('leaves the slots already cut off the first sheet empty', () => {
    const selection = fresh()
    selection.applyDefaults([label('A')])
    selection.toggleBlockedSlot(0)
    selection.toggleBlockedSlot(1)

    const slots = selection.planFor(labels)[0]?.slots ?? []
    expect(slots[0]).toEqual({ kind: 'empty', reason: 'blocked' })
    expect(slots[2]).toMatchObject({ kind: 'label', labelId: 'A' })
  })

  it('toggles a blocked slot back', () => {
    const selection = fresh()
    selection.toggleBlockedSlot(2)
    expect(selection.isBlocked(2)).toBe(true)

    selection.toggleBlockedSlot(2)
    expect(selection.isBlocked(2)).toBe(false)
  })

  it('ignores slot numbers that are not on the sheet', () => {
    const selection = fresh()
    selection.toggleBlockedSlot(9)

    expect(selection.state.blockedFirstSheetSlots).toEqual([])
  })

  it('accepts higher slot numbers on a denser grid', () => {
    const selection = fresh()
    selection.toggleBlockedSlot(11, 16)

    expect(selection.isBlocked(11)).toBe(true)
  })

  it('forgets blocked slots the new grid no longer has', () => {
    // Switching from sixteen a sheet down to four would otherwise leave slot 12
    // blocked invisibly, only to reappear on switching back.
    const selection = fresh()
    selection.toggleBlockedSlot(1, 16)
    selection.toggleBlockedSlot(12, 16)

    selection.pruneBlockedSlots(4)

    expect(selection.state.blockedFirstSheetSlots).toEqual([1])
  })

  it('leaves the list alone when everything still fits', () => {
    const selection = fresh()
    selection.toggleBlockedSlot(1, 4)
    selection.pruneBlockedSlots(9)

    expect(selection.state.blockedFirstSheetSlots).toEqual([1])
  })

  it('lays labels out on whatever grid it is given', () => {
    const selection = fresh()
    const labels = Array.from({ length: 10 }, (_, index) => label(`p${index}`))
    selection.applyDefaults(labels)

    expect(selection.planFor(labels, 4)).toHaveLength(3)
    expect(selection.planFor(labels, 9)).toHaveLength(2)
    expect(selection.planFor(labels, 16)).toHaveLength(1)
  })
})

describe('selection persistence', () => {
  it('comes back after a reload', async () => {
    const backing = memoryStorage()
    const first = createSelection({ storage: createSafeStorage(() => backing) })
    first.setCopies('A', 3)
    first.toggleBlockedSlot(1)

    // The storage watcher is deep and therefore asynchronous.
    await new Promise((resolve) => setTimeout(resolve, 0))

    const second = createSelection({ storage: createSafeStorage(() => backing) })
    expect(second.copiesOf('A')).toBe(3)
    expect(second.isBlocked(1)).toBe(true)
  })
})
