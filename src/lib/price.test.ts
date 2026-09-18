import { describe, expect, it } from 'vitest'

import { computePriceView, exhibitedWithoutPrice, formatCents, sumCents } from '@/lib/price'
import type { Label, LabelExtra } from '@/lib/types'

// Intl puts U+00A0 or U+202F before the currency sign depending on the ICU
// version bundled with Node. Normalising here keeps the suite from breaking on
// the next Node upgrade; the print output wants the real no-break space, so
// only the assertions normalise, never the code under test.
const euro = (cents: number): string => formatCents(cents).replaceAll(/\s/gu, ' ')

const extra = (over: Partial<LabelExtra> = {}): LabelExtra => ({
  name: 'Bergmann',
  artNr: '4712',
  priceCents: 12_900,
  priceText: null,
  exhibited: false,
  ...over
})

const label = (over: Partial<Label> = {}): Label => ({
  id: 'M-01',
  name: 'Mühle "Seiffen"',
  subtitle: 'KWO · Erle, handbemalt',
  artNr: '4711',
  priceCents: 89_000,
  priceNote: null,
  note: null,
  copies: 1,
  preselected: true,
  layout: null,
  extras: [],
  sourceRow: 2,
  ...over
})

describe('formatCents', () => {
  it('formats German currency', () => {
    expect(euro(114_800)).toBe('1.148,00 €')
    expect(euro(8900)).toBe('89,00 €')
    expect(euro(0)).toBe('0,00 €')
    expect(euro(7)).toBe('0,07 €')
  })

  it('keeps the sign', () => {
    expect(euro(-500)).toBe('-5,00 €')
  })
})

describe('sumCents', () => {
  it('adds without floating point drift', () => {
    // The canonical trap: 0.1 + 0.2 is 0.30000000000000004 in floats.
    expect(sumCents([10, 20])).toBe(30)
    expect(euro(sumCents([10, 20]))).toBe('0,30 €')
    expect(sumCents(Array.from({ length: 10 }, () => 7))).toBe(70)
  })

  it('is zero for nothing', () => {
    expect(sumCents([])).toBe(0)
  })
})

describe('computePriceView', () => {
  it('shows the base price when nothing is on display with the piece', () => {
    const view = computePriceView(label({ priceCents: 8900 }))

    expect(view.mode).toBe('base')
    expect(view.mainCents).toBe(8900)
    expect(view.breakdown).toEqual([])
  })

  it('carries the seller qualifier under the base price', () => {
    const view = computePriceView(label({ priceNote: 'je Stück' }))

    expect(view.suffix).toBe('je Stück')
  })

  it('lists add-ons that are not on display as information only', () => {
    const view = computePriceView(label({ extras: [extra({ name: 'Ersatzkerzen', artNr: '3303', priceCents: 490 })] }))

    expect(view.mode).toBe('base')
    expect(view.mainCents).toBe(89_000)
    expect(view.breakdown).toHaveLength(1)
    expect(view.breakdown[0]?.label).toBe('Ersatzkerzen')
  })

  it('totals the exhibited piece and demotes the base price into the breakdown', () => {
    // The Mühle from the plan: 890 on its own, 1148 as it stands in the shop.
    const view = computePriceView(
      label({
        priceCents: 89_000,
        priceNote: 'ohne Figuren',
        extras: [
          extra({ name: 'Bergmann', artNr: '4712', priceCents: 12_900, exhibited: true }),
          extra({ name: 'Engel', artNr: '4713', priceCents: 12_900, exhibited: true })
        ]
      })
    )

    expect(view.mode).toBe('exhibition')
    expect(view.mainCents).toBe(114_800)
    expect(euro(view.mainCents)).toBe('1.148,00 €')
    expect(view.suffix).toBe('wie ausgestellt')

    expect(view.breakdown.map((row) => [row.label, row.amountText.replaceAll(/\s/gu, ' ')])).toEqual([
      ['ohne Figuren', '890,00 €'],
      ['Bergmann', '129,00 €'],
      ['Engel', '129,00 €']
    ])
  })

  it('names the leading breakdown row "Grundpreis" when no qualifier was given', () => {
    const view = computePriceView(label({ priceNote: null, extras: [extra({ exhibited: true })] }))

    expect(view.breakdown[0]?.label).toBe('Grundpreis')
  })

  it('prints free-text prices verbatim instead of an amount', () => {
    const view = computePriceView(
      label({
        extras: [extra({ name: 'weitere Figuren', artNr: null, priceCents: null, priceText: 'ab 90,00 €' })]
      })
    )

    expect(view.breakdown[0]?.amountText).toBe('ab 90,00 €')
  })

  it('switches to exhibition mode even when an exhibited add-on has no number', () => {
    // It cannot be added up, so the total is short -- but hiding the fact by
    // falling back to base mode would print a price for a piece nobody is
    // selling. The importer flags it instead.
    const incomplete = label({
      extras: [extra({ name: 'Figuren', priceCents: null, priceText: 'ab 90,00 €', exhibited: true })]
    })
    const view = computePriceView(incomplete)

    expect(view.mode).toBe('exhibition')
    expect(view.mainCents).toBe(89_000)
    expect(exhibitedWithoutPrice(incomplete)).toHaveLength(1)
  })

  it('reports nothing to flag when every exhibited add-on has a price', () => {
    expect(exhibitedWithoutPrice(label({ extras: [extra({ exhibited: true })] }))).toEqual([])
  })
})
