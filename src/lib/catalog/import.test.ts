import { describe, expect, it } from 'vitest'

import { catalogFromLabels, partKey } from '@/lib/catalog/import'
import { effectivePrice, partsById, resolveLabels } from '@/lib/catalog/resolve'
import type { Label, LabelExtra } from '@/lib/types'

const extra = (over: Partial<LabelExtra> = {}): LabelExtra => ({
  name: 'Bergmann',
  artNr: '4712',
  priceCents: 12_900,
  priceText: null,
  exhibited: true,
  ...over
})

const label = (id: string, over: Partial<Label> = {}): Label => ({
  id,
  name: `Produkt ${id}`,
  subtitle: null,
  artNr: null,
  priceCents: 50_000,
  priceNote: null,
  note: null,
  copies: 1,
  preselected: true,
  layout: null,
  extras: [],
  sourceRow: 2,
  ...over
})

describe('partKey', () => {
  it('uses the article number when there is one', () => {
    expect(partKey({ name: 'Bergmann', artNr: '4712' })).toBe(partKey({ name: 'Bergmann-Figur', artNr: '4712' }))
  })

  it('falls back to the name, ignoring case and stray spaces', () => {
    expect(partKey({ name: 'Bergmann', artNr: null })).toBe(partKey({ name: '  bergmann  ', artNr: null }))
    expect(partKey({ name: 'Bergmann  mit   Lampe', artNr: null })).toBe(
      partKey({ name: 'bergmann mit lampe', artNr: null })
    )
  })

  it('keeps different parts apart', () => {
    expect(partKey({ name: 'Bergmann', artNr: '4712' })).not.toBe(partKey({ name: 'Engel', artNr: '4713' }))
  })
})

describe('folding sheet rows into a catalogue', () => {
  it('stores a part once even when several products use it', () => {
    const { catalog, mergedRows } = catalogFromLabels([
      label('M-01', { extras: [extra()] }),
      label('P-01', { extras: [extra()] }),
      label('S-01', { extras: [extra()] })
    ])

    expect(catalog.parts).toHaveLength(1)
    expect(mergedRows).toBe(2)
    expect(catalog.products.every((product) => product.parts[0]?.partId === catalog.parts[0]?.id)).toBe(true)
  })

  it('keeps genuinely different parts apart', () => {
    const { catalog } = catalogFromLabels([
      label('M-01', { extras: [extra(), extra({ name: 'Engel', artNr: '4713' })] })
    ])

    expect(catalog.parts.map((part) => part.name)).toEqual(['Bergmann', 'Engel'])
  })

  it('turns a differing price into an override instead of losing it', () => {
    // The spreadsheet allowed the same figure to cost different things on
    // different products; folding must not quietly pick one and discard the rest.
    const { catalog, overrides } = catalogFromLabels([
      label('M-01', { extras: [extra({ priceCents: 12_900 })] }),
      label('P-01', { extras: [extra({ priceCents: 13_900 })] })
    ])

    expect(overrides).toBe(1)
    expect(catalog.parts).toHaveLength(1)
    expect(catalog.parts[0]?.priceCents).toBe(12_900)
    expect(catalog.products[0]?.parts[0]?.priceCentsOverride).toBeNull()
    expect(catalog.products[1]?.parts[0]?.priceCentsOverride).toBe(13_900)
  })

  it('treats a differing free text as an override too', () => {
    const { catalog } = catalogFromLabels([
      label('M-01', { extras: [extra({ priceCents: null, priceText: 'ab 90,00 €' })] }),
      label('P-01', { extras: [extra({ priceCents: null, priceText: 'auf Anfrage' })] })
    ])

    expect(catalog.products[1]?.parts[0]?.priceTextOverride).toBe('auf Anfrage')
  })

  it('keeps the exhibited flag per attachment, not per part', () => {
    // The same figure can stand with one piece and merely be orderable for another.
    const { catalog } = catalogFromLabels([
      label('M-01', { extras: [extra({ exhibited: true })] }),
      label('P-01', { extras: [extra({ exhibited: false })] })
    ])

    expect(catalog.parts).toHaveLength(1)
    expect(catalog.products.map((product) => product.parts[0]?.exhibited)).toEqual([true, false])
  })

  it('preserves the sheet order', () => {
    const { catalog } = catalogFromLabels([label('A'), label('B'), label('C')])

    expect(catalog.products.map((product) => product.sortIndex)).toEqual([0, 1, 2])
  })
})

describe('folding and resolving are inverse', () => {
  it('returns exactly the labels it started from', () => {
    // The round trip is what makes importing a sheet safe: nothing printed may
    // change just because the data was reorganised underneath.
    const original = [
      label('M-01', {
        name: 'Mühle',
        priceNote: 'ohne Figuren',
        extras: [extra(), extra({ name: 'Engel', artNr: '4713', priceCents: 12_900 })]
      }),
      label('P-01', {
        name: 'Pyramide',
        extras: [extra({ priceCents: 13_900 }), extra({ name: 'Teelichter', artNr: '5512', priceCents: 2400 })]
      }),
      label('R-01', { name: 'Räuchermann' })
    ]

    const { catalog } = catalogFromLabels(original)

    // sourceRow is left out: it points at a row in the sheet the data came from,
    // which a catalogue entry has no equivalent of. Nothing printed depends on it.
    const printable = (labels: readonly Label[]) => labels.map(({ sourceRow: _row, ...rest }) => rest)

    expect(printable(resolveLabels(catalog))).toEqual(printable(original))
  })

  it('resolves an overridden attachment to its own price', () => {
    const { catalog } = catalogFromLabels([
      label('M-01', { extras: [extra({ priceCents: 12_900 })] }),
      label('P-01', { extras: [extra({ priceCents: 13_900 })] })
    ])
    const parts = partsById(catalog.parts)
    const link = catalog.products[1]!.parts[0]!

    expect(effectivePrice(link, parts.get(link.partId)!)).toEqual({ priceCents: 13_900, priceText: null })
  })
})
