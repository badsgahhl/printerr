import { describe, expect, it } from 'vitest'

import {
  breakdownArtNrWidthMm,
  breakdownHeightMm,
  contentHeightMm,
  contentWidthMm,
  DEFAULT_LABEL_STYLE,
  fontRanges,
  FONT_SIZE_KEYS,
  footHeightMm,
  GRID_PRESETS,
  gridOf,
  headHeightMm,
  type LabelContent,
  type LabelStyle,
  labelBoxes,
  labelCssVars,
  labelHeightMm,
  labelWidthMm,
  mmToPx,
  paddingMm,
  priceBlockHeightMm,
  REFERENCE_HEIGHT_MM,
  SAFE_PADDING_MM,
  REFERENCE_WIDTH_MM,
  SHEET_HEIGHT_MM,
  SHEET_WIDTH_MM,
  sheetCssVars,
  slotsPerSheet,
  STYLE_LIMITS
} from '@/print/geometry'

const styled = (over: Partial<LabelStyle>): LabelStyle => ({ ...DEFAULT_LABEL_STYLE, ...over })

/** A label that prints every optional text, with the given number of add-on rows. */
const full = (breakdownRows = 0, over: Partial<LabelContent> = {}): LabelContent => ({
  breakdownRows,
  breakdownHasArtNr: false,
  subtitle: true,
  artNr: true,
  priceSuffix: true,
  note: true,
  brand: true,
  ...over
})

const OPTIONAL_TEXTS = ['subtitle', 'artNr', 'priceSuffix', 'note', 'brand'] as const

/** Every combination of optional texts a label can print or leave out. */
const allContents = (breakdownRows: number): LabelContent[] =>
  Array.from({ length: 2 ** OPTIONAL_TEXTS.length }, (_, bits) =>
    full(breakdownRows, Object.fromEntries(OPTIONAL_TEXTS.map((text, index) => [text, (bits & (1 << index)) !== 0])))
  )

/** Every grid the settings can produce, not just the presets. */
const allGrids = Array.from({ length: STYLE_LIMITS.columns.max }, (_, c) =>
  Array.from({ length: STYLE_LIMITS.rows.max }, (_, r) => ({ columns: c + 1, rows: r + 1 }))
).flat()

describe('dividing the sheet', () => {
  it('tiles A4 exactly, whatever the grid', () => {
    // No waste and no drift: every cut line has to land on a whole number of
    // label widths, or the grid stops matching the paper.
    const mismatched = allGrids.filter((grid) => {
      const style = styled(grid)
      return (
        Math.abs(labelWidthMm(style) * grid.columns - SHEET_WIDTH_MM) > 1e-9 ||
        Math.abs(labelHeightMm(style) * grid.rows - SHEET_HEIGHT_MM) > 1e-9
      )
    })

    expect(mismatched).toEqual([])
  })

  it('defaults to a quarter of A4', () => {
    expect(labelWidthMm()).toBe(REFERENCE_WIDTH_MM)
    expect(labelHeightMm()).toBe(REFERENCE_HEIGHT_MM)
    expect(slotsPerSheet(DEFAULT_LABEL_STYLE)).toBe(4)
  })

  it('counts the slots a grid provides', () => {
    expect(slotsPerSheet(styled({ columns: 3, rows: 4 }))).toBe(12)
    expect(slotsPerSheet(styled({ columns: 1, rows: 1 }))).toBe(1)
  })

  it('pulls a nonsensical grid back into range', () => {
    // Stored settings outlive app versions and are not to be trusted.
    expect(gridOf(styled({ columns: 0, rows: 99 }))).toEqual({
      columns: STYLE_LIMITS.columns.min,
      rows: STYLE_LIMITS.rows.max
    })
    expect(gridOf(styled({ columns: 2.7, rows: 3.2 }))).toEqual({ columns: 2, rows: 3 })
  })

  it('offers only presets that divide the sheet without waste', () => {
    const wasteful = GRID_PRESETS.filter(({ grid }) => SHEET_WIDTH_MM % grid.columns !== 0 && grid.columns !== 4)
    // 4 columns gives 52.5mm, which is exact in decimal even though the modulo is not.
    expect(wasteful.map((preset) => preset.label)).toEqual([])
    expect(GRID_PRESETS.every(({ grid }) => grid.columns >= 1 && grid.rows >= 1)).toBe(true)
  })

  it('converts millimetres at the CSS reference resolution', () => {
    expect(mmToPx(25.4)).toBeCloseTo(96, 10)
  })
})

describe('label boxes at the default grid', () => {
  // Head and foot are fixed, the breakdown grows with its rows, and the price
  // block absorbs the rest -- so the four always add up to the content area.
  it.each([0, 1, 3, 6])('spends the content height exactly with %i breakdown rows', (rows) => {
    const content = full(rows)
    const total =
      headHeightMm(content) + footHeightMm(content) + priceBlockHeightMm(content) + breakdownHeightMm(content)

    expect(total).toBeCloseTo(contentHeightMm(), 10)
    expect(priceBlockHeightMm(content)).toBeGreaterThan(0)
  })

  it('spends the content height exactly whichever optional texts a label leaves out', () => {
    const broken = allContents(2).filter((content) => {
      const total =
        headHeightMm(content) + footHeightMm(content) + priceBlockHeightMm(content) + breakdownHeightMm(content)
      return Math.abs(total - contentHeightMm()) > 1e-9
    })

    expect(broken).toEqual([])
  })

  it('shrinks the price block as breakdown rows are added', () => {
    expect(priceBlockHeightMm(full(0))).toBeGreaterThan(priceBlockHeightMm(full(3)))
  })

  it.each(OPTIONAL_TEXTS)('gives the room of a missing %s to the price', (text) => {
    expect(labelBoxes(full(2, { [text]: false })).price.height).toBeGreaterThan(labelBoxes(full(2)).price.height)
  })

  it('has no breakdown block when there is nothing to break down', () => {
    expect(breakdownHeightMm(full(0))).toBe(0)
    expect(breakdownHeightMm(full(-1))).toBe(0)
  })

  it('keeps every box inside the printable content area', () => {
    const boxes = labelBoxes(full(4))
    const maxWidth = mmToPx(contentWidthMm())

    const broken = Object.entries(boxes)
      .filter(([, box]) => box.width <= 0 || box.height <= 0 || box.width > maxWidth + 0.001)
      .map(([name]) => name)

    expect(broken).toEqual([])
  })

  it('takes the article number column out of the description width', () => {
    // Without this the description is measured against a width it never gets,
    // and a long one like "Bergmann-Figuren (6 Stück)" ends up clipped.
    const withArtNr = labelBoxes(full(2, { breakdownHasArtNr: true }))
    const withoutArtNr = labelBoxes(full(2))

    expect(withArtNr.breakdownLabel.width).toBeLessThan(withoutArtNr.breakdownLabel.width)
  })

  it('reserves nothing for article numbers when no row has one', () => {
    expect(breakdownArtNrWidthMm(false)).toBe(0)
  })
})

describe('label boxes follow the text sizes', () => {
  it('gives a bigger text a taller box, and takes the room from the price', () => {
    const big = styled({ noteMaxPx: 30 })

    expect(labelBoxes(full(2), big).note.height).toBeGreaterThan(labelBoxes(full(2)).note.height)
    expect(priceBlockHeightMm(full(2), big)).toBeLessThan(priceBlockHeightMm(full(2)))
    expect(headHeightMm(full(2), big)).toBe(headHeightMm(full(2)))
  })

  it.each([
    ['subtitleMaxPx', 'subtitle'],
    ['artNrMaxPx', 'artNr'],
    ['priceSuffixMaxPx', 'priceSuffix'],
    ['noteMaxPx', 'note'],
    ['brandMaxPx', 'brand']
  ] as const)('leaves a label alone when %s changes but it has no %s', (sizeKey, text) => {
    // The shop-name size used to move every price on the sheet even with no shop
    // name switched on, because the foot kept its room whether it was used or not.
    const without = full(2, { [text]: false })
    const layout = (style: LabelStyle) => ({
      head: headHeightMm(without, style),
      foot: footHeightMm(without, style),
      price: labelBoxes(without, style).price
    })

    expect(layout(styled({ [sizeKey]: STYLE_LIMITS[sizeKey].max }))).toEqual(layout(DEFAULT_LABEL_STYLE))
    expect(layout(styled({ [sizeKey]: STYLE_LIMITS[sizeKey].min }))).toEqual(layout(DEFAULT_LABEL_STYLE))
  })

  it('leaves a label without add-ons alone when their size changes', () => {
    const bigger = styled({ breakdownMaxPx: STYLE_LIMITS.breakdownMaxPx.max })

    expect(priceBlockHeightMm(full(0), bigger)).toBe(priceBlockHeightMm(full(0)))
  })

  it('keeps each box roomy enough for its own text at full size', () => {
    // A box that grew slower than its type would clip the text it was sized for.
    const cramped = FONT_SIZE_KEYS.flatMap((key) =>
      [STYLE_LIMITS[key].min, STYLE_LIMITS[key].max].flatMap((size) => {
        const style = styled({ [key]: size })
        const boxes = labelBoxes(full(2), style)
        const ranges = fontRanges(style)
        return (Object.keys(ranges) as (keyof typeof ranges)[])
          .filter((styleKey) => styleKey !== 'price' && boxes[styleKey].height < ranges[styleKey].maxPx * 1.12)
          .map((styleKey) => `${key}=${size}:${styleKey}`)
      })
    )

    expect(cramped).toEqual([])
  })

  it('spends the content height exactly whatever size a single text is set to', () => {
    const broken = FONT_SIZE_KEYS.flatMap((key) =>
      [STYLE_LIMITS[key].min, STYLE_LIMITS[key].max]
        .map((size) => styled({ [key]: size }))
        .filter((style) => {
          const content = full(3)
          const total =
            headHeightMm(content, style) +
            footHeightMm(content, style) +
            priceBlockHeightMm(content, style) +
            breakdownHeightMm(content, style)
          return Math.abs(total - contentHeightMm(style)) > 1e-6
        })
        .map(() => key)
    )

    expect(broken).toEqual([])
  })
})

describe('a single-line text that had to shrink', () => {
  it('claims only the height it still needs, and gives the rest to the price', () => {
    const shrunk = full(2, { fitPx: { note: fontRanges().note.maxPx / 2 } })

    expect(labelBoxes(shrunk).note.height).toBeCloseTo(labelBoxes(full(2)).note.height / 2, 6)
    expect(labelBoxes(shrunk).price.height).toBeGreaterThan(labelBoxes(full(2)).price.height)
  })

  it('moves nothing once its slider is past the size it fits at', () => {
    // "Ausgabe an der Kasse!" stops growing at the width of the label. Turning
    // its slider further up must not go on taking height from the price.
    const fitted = full(2, { fitPx: { note: 20 } })

    expect(labelCssVars(fitted, styled({ noteMaxPx: 34 }))).toEqual(labelCssVars(fitted, styled({ noteMaxPx: 24 })))
  })

  it('claims its full height until it has been measured', () => {
    expect(labelBoxes(full(2, { fitPx: {} }))).toEqual(labelBoxes(full(2)))
  })

  it('never claims more than its full height', () => {
    const oversized = full(2, { fitPx: { note: fontRanges().note.maxPx * 3 } })

    expect(labelBoxes(oversized).note).toEqual(labelBoxes(full(2)).note)
  })

  it('keeps an add-on row as tall as the larger of its two texts', () => {
    const ranges = fontRanges()
    const content = full(2, {
      fitPx: { breakdownLabel: ranges.breakdownLabel.minPx, breakdownAmount: ranges.breakdownAmount.maxPx }
    })

    expect(breakdownHeightMm(content)).toBe(breakdownHeightMm(full(2)))
  })

  it('still spends the content height exactly', () => {
    const ranges = fontRanges()
    const content = full(3, {
      fitPx: Object.fromEntries(Object.entries(ranges).map(([key, range]) => [key, range.minPx]))
    })
    const total =
      headHeightMm(content) + footHeightMm(content) + priceBlockHeightMm(content) + breakdownHeightMm(content)

    expect(total).toBeCloseTo(contentHeightMm(), 10)
  })
})

describe('label boxes follow the grid', () => {
  it('shrinks the label as the sheet is divided further', () => {
    const nine = styled({ columns: 3, rows: 3 })

    expect(labelWidthMm(nine)).toBeCloseTo(70, 6)
    expect(labelHeightMm(nine)).toBeCloseTo(99, 6)
    expect(labelBoxes(full(0), nine).name.width).toBeLessThan(labelBoxes(full(0)).name.width)
  })

  it('scales type down with the label, not just the boxes', () => {
    // Left at their reference size, 72px of price would be most of a 74mm label.
    const sixteen = styled({ columns: 4, rows: 4 })

    expect(fontRanges(sixteen).price.maxPx).toBeLessThan(fontRanges().price.maxPx)
    expect(fontRanges(sixteen).name.maxPx).toBeLessThan(fontRanges().name.maxPx)
  })

  it('scales type up for a whole sheet', () => {
    expect(fontRanges(styled({ columns: 1, rows: 1 })).price.maxPx).toBeGreaterThan(fontRanges().price.maxPx)
  })

  it('follows the smaller dimension, so a short wide label still fits vertically', () => {
    // 1x4 is full width but only 74mm tall; sizing on width alone would overflow.
    const wideAndShort = styled({ columns: 1, rows: 4 })

    expect(fontRanges(wideAndShort).price.maxPx).toBeLessThan(fontRanges().price.maxPx)
  })

  it('spends the content height exactly at every grid', () => {
    const broken = allGrids.filter((grid) => {
      const style = styled(grid)
      const content = full(2)
      const total =
        headHeightMm(content, style) +
        footHeightMm(content, style) +
        priceBlockHeightMm(content, style) +
        breakdownHeightMm(content, style)
      return Math.abs(total - contentHeightMm(style)) > 1e-6
    })

    expect(broken).toEqual([])
  })

  it('never produces a box with no room in it, at any grid', () => {
    const broken = allGrids.flatMap((grid) => {
      const style = styled(grid)
      return Object.entries(labelBoxes(full(3, { breakdownHasArtNr: true }), style))
        .filter(([, box]) => box.width <= 0 || box.height <= 0)
        .map(([name]) => `${grid.columns}x${grid.rows}:${name}`)
    })

    expect(broken).toEqual([])
  })

  it('flags the grids where the margin drops below what a printer reaches', () => {
    // Not a floor: only the labels on the edge of the sheet are at risk, so the
    // app warns instead of overriding the choice.
    const tight = allGrids.filter((grid) => paddingMm(styled(grid)) < SAFE_PADDING_MM)

    expect(paddingMm(styled({ columns: 2, rows: 2 }))).toBeGreaterThanOrEqual(SAFE_PADDING_MM)
    expect(tight.length).toBeGreaterThan(0)
    expect(tight.every((grid) => grid.columns > 2 || grid.rows > 2)).toBe(true)
  })

  it('keeps the margin printable even on the smallest label', () => {
    // A margin that scales without a floor would let a tiny label put text where
    // the printer cannot reach.
    const tiny = styled({ columns: 6, rows: 6 })

    expect(paddingMm(tiny)).toBeGreaterThanOrEqual(STYLE_LIMITS.paddingMm.min)
    expect(contentWidthMm(tiny)).toBeGreaterThan(0)
  })
})

describe('font ranges', () => {
  it('gives the price the largest type on the label', () => {
    expect(fontRanges().price.maxPx).toBeGreaterThan(fontRanges().name.maxPx)
  })

  it('follows the settings', () => {
    const ranges = fontRanges(styled({ priceMaxPx: 90, nameMaxPx: 20, noteMaxPx: 30 }))

    expect(ranges.price.maxPx).toBeCloseTo(90, 6)
    expect(ranges.name.maxPx).toBeCloseTo(20, 6)
    expect(ranges.note.maxPx).toBeCloseTo(30, 6)
  })

  it('gives every text a size of its own', () => {
    // "Ausgabe an der Kasse!" has to be able to grow without dragging the
    // subtitle, the add-ons and the shop name along with it.
    const before = fontRanges()
    const after = fontRanges(styled({ noteMaxPx: 30 }))

    const moved = (Object.keys(before) as (keyof typeof before)[]).filter(
      (key) => before[key].maxPx !== after[key].maxPx
    )
    expect(moved).toEqual(['note'])
  })

  it('keeps description and amount of an add-on row at the same size', () => {
    const ranges = fontRanges(styled({ breakdownMaxPx: 18 }))

    expect(ranges.breakdownLabel.maxPx).toBe(ranges.breakdownAmount.maxPx)
  })

  it('keeps the minimum below the maximum at every grid and setting', () => {
    // Otherwise the search would be handed an empty range and return nonsense.
    const broken = allGrids.flatMap((grid) => {
      const style = styled({
        ...grid,
        ...Object.fromEntries(FONT_SIZE_KEYS.map((key) => [key, STYLE_LIMITS[key].min]))
      })
      return Object.entries(fontRanges(style))
        .filter(([, range]) => range.minPx >= range.maxPx || range.minPx <= 0)
        .map(([key]) => `${grid.columns}x${grid.rows}:${key}`)
    })

    expect(broken).toEqual([])
  })
})

describe('css custom properties', () => {
  it('hands the stylesheet the same numbers the boxes were built from', () => {
    const vars = labelCssVars(full(3))

    expect(vars['--label-w']).toBe('105mm')
    expect(vars['--label-h']).toBe('148.5mm')
  })

  it('carries the chosen grid into the sheet', () => {
    const vars = sheetCssVars(styled({ columns: 3, rows: 4 }))

    expect(vars['--sheet-cols']).toBe('3')
    expect(vars['--sheet-rows']).toBe('4')
    expect(vars['--label-w']).toBe('70mm')
    expect(vars['--label-h']).toBe('74.25mm')
  })

  it('expresses every label value in millimetres', () => {
    const notMillimetres = Object.entries(labelCssVars(full(2)))
      .filter(([, value]) => !/^-?\d+(\.\d+)?mm$/u.test(value))
      .map(([key]) => key)

    expect(notMillimetres).toEqual([])
  })

  it('rounds away floating point noise the grid would otherwise produce', () => {
    const noisy = Object.entries(labelCssVars(full(3, { breakdownHasArtNr: true }), styled({ columns: 3, rows: 3 })))
      .filter(([, value]) => (/\.(\d+)mm$/u.exec(value)?.[1]?.length ?? 0) > 3)
      .map(([key]) => key)

    expect(noisy).toEqual([])
  })
})
