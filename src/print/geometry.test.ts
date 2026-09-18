import { describe, expect, it } from 'vitest'

import {
  breakdownArtNrWidthMm,
  breakdownHeightMm,
  COLUMNS,
  contentHeightMm,
  contentWidthMm,
  DEFAULT_LABEL_STYLE,
  fontRanges,
  footHeightMm,
  headHeightMm,
  LABEL_HEIGHT_MM,
  LABEL_WIDTH_MM,
  type LabelStyle,
  labelBoxes,
  labelCssVars,
  mmToPx,
  priceBlockHeightMm,
  ROWS,
  SHEET_HEIGHT_MM,
  SHEET_WIDTH_MM,
  STYLE_LIMITS
} from '@/print/geometry'

const styled = (over: Partial<LabelStyle>): LabelStyle => ({ ...DEFAULT_LABEL_STYLE, ...over })

describe('sheet geometry', () => {
  it('tiles A4 exactly, with no waste', () => {
    // The whole reason for 148.5 rather than ISO A6's 148.
    expect(LABEL_WIDTH_MM * COLUMNS).toBe(SHEET_WIDTH_MM)
    expect(LABEL_HEIGHT_MM * ROWS).toBe(SHEET_HEIGHT_MM)
  })

  it('converts millimetres at the CSS reference resolution', () => {
    expect(mmToPx(25.4)).toBeCloseTo(96, 10)
  })
})

describe('label boxes at the default style', () => {
  // Head and foot are fixed, the breakdown grows with its rows, and the price
  // block absorbs the rest -- so the four always add up to the content area.
  it.each([0, 1, 3, 6])('spends the content height exactly with %i breakdown rows', (rows) => {
    const total = headHeightMm() + footHeightMm() + priceBlockHeightMm(rows) + breakdownHeightMm(rows)

    expect(total).toBeCloseTo(contentHeightMm(), 10)
    expect(priceBlockHeightMm(rows)).toBeGreaterThan(0)
  })

  it('shrinks the price block as breakdown rows are added', () => {
    expect(priceBlockHeightMm(0)).toBeGreaterThan(priceBlockHeightMm(3))
    expect(priceBlockHeightMm(3)).toBeGreaterThan(priceBlockHeightMm(6))
  })

  it('has no breakdown block when there is nothing to break down', () => {
    expect(breakdownHeightMm(0)).toBe(0)
    expect(breakdownHeightMm(-1)).toBe(0)
  })

  it('keeps every box inside the printable content area', () => {
    const boxes = labelBoxes(4)
    const maxWidth = mmToPx(contentWidthMm())

    // Collected rather than asserted one by one, so a failure names every box
    // that is wrong instead of stopping at the first.
    const broken = Object.entries(boxes)
      .filter(([, box]) => box.width <= 0 || box.height <= 0 || box.width > maxWidth + 0.001)
      .map(([name]) => name)

    expect(broken).toEqual([])
  })

  it('splits a breakdown row between label and amount without overlap', () => {
    const boxes = labelBoxes(2)

    expect(boxes.breakdownLabel.width + boxes.breakdownAmount.width).toBeLessThanOrEqual(mmToPx(contentWidthMm()))
  })

  it('takes the article number column out of the description width', () => {
    // Without this the description is measured against a width it never gets,
    // and a long one like "Bergmann-Figuren (6 Stück)" ends up clipped.
    const withArtNr = labelBoxes(2, true)
    const withoutArtNr = labelBoxes(2, false)

    expect(withArtNr.breakdownLabel.width).toBeLessThan(withoutArtNr.breakdownLabel.width)
    expect(
      withArtNr.breakdownLabel.width + withArtNr.breakdownAmount.width + mmToPx(breakdownArtNrWidthMm(true))
    ).toBeLessThanOrEqual(mmToPx(contentWidthMm()))
  })

  it('reserves nothing for article numbers when no row has one', () => {
    expect(breakdownArtNrWidthMm(false)).toBe(0)
  })

  it('still leaves a usable price block at the busiest layout', () => {
    // Ten add-ons is far past anything realistic; the label must not collapse.
    expect(priceBlockHeightMm(10)).toBeGreaterThan(10)
  })
})

describe('label boxes react to the settings', () => {
  it('gives the name more room when its maximum is raised', () => {
    const bigger = styled({ nameMaxPx: 50 })

    expect(labelBoxes(0, false, bigger).name.height).toBeGreaterThan(labelBoxes(0).name.height)
    expect(headHeightMm(bigger)).toBeGreaterThan(headHeightMm())
  })

  it('takes that room out of the price block, not out of thin air', () => {
    const bigger = styled({ nameMaxPx: 50 })
    const total =
      headHeightMm(bigger) + footHeightMm(bigger) + priceBlockHeightMm(2, bigger) + breakdownHeightMm(2, bigger)

    expect(priceBlockHeightMm(2, bigger)).toBeLessThan(priceBlockHeightMm(2))
    expect(total).toBeCloseTo(contentHeightMm(bigger), 10)
  })

  it('narrows the content area when the margin grows', () => {
    const wide = styled({ paddingMm: 14 })

    expect(contentWidthMm(wide)).toBeLessThan(contentWidthMm())
    expect(labelBoxes(0, false, wide).name.width).toBeLessThan(labelBoxes(0).name.width)
  })

  it('scales the small text together', () => {
    const bigger = styled({ detailMaxPx: 16 })
    const boxes = labelBoxes(3, true, bigger)
    const base = labelBoxes(3, true)

    expect(boxes.subtitle.height).toBeGreaterThan(base.subtitle.height)
    expect(boxes.breakdownLabel.height).toBeGreaterThan(base.breakdownLabel.height)
    expect(boxes.brand.height).toBeGreaterThan(base.brand.height)
  })

  it('never collapses the price block, however extreme the settings', () => {
    // Everything pushed to its limit at once: the label must still be printable.
    const extreme = styled({
      paddingMm: STYLE_LIMITS.paddingMm.max,
      nameMaxPx: STYLE_LIMITS.nameMaxPx.max,
      detailMaxPx: STYLE_LIMITS.detailMaxPx.max
    })

    expect(priceBlockHeightMm(8, extreme)).toBeGreaterThanOrEqual(12)
    const boxes = labelBoxes(8, true, extreme)
    const broken = Object.entries(boxes)
      .filter(([, box]) => box.width <= 0 || box.height < 0)
      .map(([name]) => name)

    expect(broken).toEqual([])
  })

  it('stays sane at the smallest settings too', () => {
    const tiny = styled({
      paddingMm: STYLE_LIMITS.paddingMm.min,
      nameMaxPx: STYLE_LIMITS.nameMaxPx.min,
      priceMaxPx: STYLE_LIMITS.priceMaxPx.min,
      detailMaxPx: STYLE_LIMITS.detailMaxPx.min
    })
    const boxes = labelBoxes(3, true, tiny)

    expect(boxes.name.height).toBeGreaterThan(0)
    expect(boxes.breakdownLabel.width).toBeGreaterThan(0)
    expect(priceBlockHeightMm(3, tiny)).toBeGreaterThan(0)
  })
})

describe('font ranges', () => {
  it('has a usable range for every style key', () => {
    const broken = Object.entries(fontRanges())
      .filter(([, range]) => range.minPx <= 0 || range.maxPx <= range.minPx)
      .map(([key]) => key)

    expect(broken).toEqual([])
  })

  it('gives the price the largest type on the label', () => {
    expect(fontRanges().price.maxPx).toBeGreaterThan(fontRanges().name.maxPx)
  })

  it('follows the settings', () => {
    const ranges = fontRanges(styled({ priceMaxPx: 90, nameMaxPx: 20, detailMaxPx: 16 }))

    expect(ranges.price.maxPx).toBe(90)
    expect(ranges.name.maxPx).toBe(20)
    expect(ranges.breakdownLabel.maxPx).toBe(16)
  })

  it('keeps the minimum below the maximum even at the smallest setting', () => {
    // Otherwise the search would be handed an empty range and return nonsense.
    const ranges = fontRanges(
      styled({ nameMaxPx: STYLE_LIMITS.nameMaxPx.min, detailMaxPx: STYLE_LIMITS.detailMaxPx.min })
    )
    const broken = Object.entries(ranges)
      .filter(([, range]) => range.minPx >= range.maxPx)
      .map(([key]) => key)

    expect(broken).toEqual([])
  })
})

describe('css custom properties', () => {
  it('hands the stylesheet the same numbers the boxes were built from', () => {
    const vars = labelCssVars(3)

    expect(vars['--label-w']).toBe('105mm')
    expect(vars['--label-h']).toBe('148.5mm')
    expect(vars['--label-price-h']).toBe(`${priceBlockHeightMm(3)}mm`)
    expect(vars['--label-pad']).toBe(`${DEFAULT_LABEL_STYLE.paddingMm}mm`)
  })

  it('carries the chosen margin through to CSS', () => {
    expect(labelCssVars(0, false, styled({ paddingMm: 12 }))['--label-pad']).toBe('12mm')
  })

  it('expresses every value in millimetres', () => {
    const notMillimetres = Object.entries(labelCssVars(2))
      .filter(([, value]) => !/^-?\d+(\.\d+)?mm$/u.test(value))
      .map(([key]) => key)

    expect(notMillimetres).toEqual([])
  })

  it('rounds away floating point noise the sliders would otherwise produce', () => {
    const noisy = Object.entries(labelCssVars(3, true, styled({ detailMaxPx: 13.5 })))
      .filter(([, value]) => (value.match(/\.(\d+)mm$/u)?.[1]?.length ?? 0) > 3)
      .map(([key]) => key)

    expect(noisy).toEqual([])
  })
})
