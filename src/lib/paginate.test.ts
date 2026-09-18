import { describe, expect, it } from 'vitest'

import { expandJobs, paginate, SLOTS_PER_SHEET, type SheetPlan } from '@/lib/paginate'

/** Compact view of a plan: label ids per sheet, 'b' blocked, '.' padding. */
const shape = (sheets: readonly SheetPlan[]): string[][] =>
  sheets.map((sheet) =>
    sheet.slots.map((slot) => (slot.kind === 'label' ? slot.labelId : slot.reason === 'blocked' ? 'b' : '.'))
  )

describe('expandJobs', () => {
  it('repeats a label once per copy', () => {
    expect(expandJobs([{ labelId: 'A', copies: 3 }])).toEqual([
      { labelId: 'A', copyIndex: 0 },
      { labelId: 'A', copyIndex: 1 },
      { labelId: 'A', copyIndex: 2 }
    ])
  })

  it('drops jobs with no copies', () => {
    expect(
      expandJobs([
        { labelId: 'A', copies: 0 },
        { labelId: 'B', copies: -1 }
      ])
    ).toEqual([])
  })
})

describe('paginate', () => {
  it('prints nothing for an empty selection', () => {
    expect(paginate([])).toEqual([])
    expect(paginate([{ labelId: 'A', copies: 0 }])).toEqual([])
  })

  it('fills one sheet exactly', () => {
    const sheets = paginate([
      { labelId: 'A', copies: 1 },
      { labelId: 'B', copies: 1 },
      { labelId: 'C', copies: 1 },
      { labelId: 'D', copies: 1 }
    ])

    expect(sheets).toHaveLength(1)
    expect(shape(sheets)).toEqual([['A', 'B', 'C', 'D']])
  })

  it('pads the last sheet rather than dropping labels', () => {
    const sheets = paginate([
      { labelId: 'A', copies: 1 },
      { labelId: 'B', copies: 1 },
      { labelId: 'C', copies: 1 },
      { labelId: 'D', copies: 1 },
      { labelId: 'E', copies: 1 }
    ])

    expect(shape(sheets)).toEqual([
      ['A', 'B', 'C', 'D'],
      ['E', '.', '.', '.']
    ])
  })

  it('keeps copies of the same label together', () => {
    const sheets = paginate([
      { labelId: 'A', copies: 2 },
      { labelId: 'B', copies: 1 }
    ])

    expect(shape(sheets)).toEqual([['A', 'A', 'B', '.']])
    const first = sheets[0]?.slots[0]
    const second = sheets[0]?.slots[1]
    expect(first?.kind === 'label' && first.copyIndex).toBe(0)
    expect(second?.kind === 'label' && second.copyIndex).toBe(1)
  })

  it('numbers sheets from zero', () => {
    const sheets = paginate([{ labelId: 'A', copies: 9 }])

    expect(sheets.map((sheet) => sheet.index)).toEqual([0, 1, 2])
  })
})

describe('paginate with a part-used first sheet', () => {
  it('skips the slots already cut off', () => {
    const sheets = paginate([{ labelId: 'A', copies: 3 }], { blockedFirstSheetSlots: [0, 1] })

    expect(shape(sheets)).toEqual([
      ['b', 'b', 'A', 'A'],
      ['A', '.', '.', '.']
    ])
  })

  it('blocks any combination, not just a run from the start', () => {
    // Top right and bottom left already cut out.
    const sheets = paginate([{ labelId: 'A', copies: 2 }], { blockedFirstSheetSlots: [1, 2] })

    expect(shape(sheets)).toEqual([['A', 'b', 'b', 'A']])
  })

  it('applies the blocks only to the first sheet', () => {
    const sheets = paginate([{ labelId: 'A', copies: 5 }], { blockedFirstSheetSlots: [0] })

    expect(shape(sheets)).toEqual([
      ['b', 'A', 'A', 'A'],
      ['A', 'A', '.', '.']
    ])
  })

  it('does not print a blank page when the whole first sheet is used up', () => {
    const sheets = paginate([{ labelId: 'A', copies: 2 }], { blockedFirstSheetSlots: [0, 1, 2, 3] })

    expect(shape(sheets)).toEqual([['A', 'A', '.', '.']])
    expect(sheets[0]?.index).toBe(0)
  })

  it('ignores slot numbers outside the sheet', () => {
    const sheets = paginate([{ labelId: 'A', copies: 1 }], { blockedFirstSheetSlots: [-1, 4, 99] })

    expect(shape(sheets)).toEqual([['A', '.', '.', '.']])
  })

  it('ignores a repeated slot number', () => {
    const sheets = paginate([{ labelId: 'A', copies: 1 }], { blockedFirstSheetSlots: [0, 0] })

    expect(shape(sheets)).toEqual([['b', 'A', '.', '.']])
  })
})

describe('paginate slot count', () => {
  it('defaults to four per sheet', () => {
    expect(SLOTS_PER_SHEET).toBe(4)
    expect(paginate([{ labelId: 'A', copies: 1 }])[0]?.slots).toHaveLength(4)
  })

  it('honours a different grid, for a future label size', () => {
    const sheets = paginate([{ labelId: 'A', copies: 3 }], { slotsPerSheet: 2 })

    expect(shape(sheets)).toEqual([
      ['A', 'A'],
      ['A', '.']
    ])
  })
})
