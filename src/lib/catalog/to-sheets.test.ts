import { describe, expect, it } from 'vitest'

import { catalogFromLabels } from '@/lib/catalog/import'
import { resolveLabels } from '@/lib/catalog/resolve'
import { catalogToOds } from '@/lib/catalog/to-sheets'
import { readOds } from '@/lib/ods/read-ods'
import { buildLabels } from '@/lib/schema/build-labels'
import type { Label } from '@/lib/types'

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

const printable = (labels: readonly Label[]) => labels.map(({ sourceRow: _row, ...rest }) => rest)

describe('exporting the catalogue as a sheet', () => {
  const original = [
    label('M-01', {
      name: 'Mühle „Seiffen"',
      subtitle: 'KWO · Erle',
      artNr: '4711',
      priceCents: 89_000,
      priceNote: 'ohne Figuren',
      note: 'Handarbeit',
      extras: [
        { name: 'Bergmann', artNr: '4712', priceCents: 12_900, priceText: null, exhibited: true },
        { name: 'weitere Figuren', artNr: null, priceCents: null, priceText: 'ab 90,00 €', exhibited: false }
      ]
    }),
    label('P-01', {
      name: 'Pyramide',
      copies: 2,
      preselected: false,
      extras: [{ name: 'Bergmann', artNr: '4712', priceCents: 13_900, priceText: null, exhibited: true }]
    }),
    label('R-01', { name: 'Räuchermann' })
  ]

  const catalog = catalogFromLabels(original).catalog

  it('produces a file the app can read straight back', () => {
    const { sheets, diagnostics } = readOds(catalogToOds(catalog))

    expect(diagnostics).toEqual([])
    expect(sheets.map((sheet) => sheet.name)).toEqual(['Produkte', 'Zusätze'])
  })

  it('prints the same labels after a full round trip through a sheet', () => {
    // Catalogue -> .ods -> reader -> labels has to land on exactly what the app
    // would have printed from the catalogue directly.
    const { sheets } = readOds(catalogToOds(catalog))
    const { labels, diagnostics } = buildLabels(sheets)

    expect(diagnostics).toEqual([])
    expect(printable(labels)).toEqual(printable(resolveLabels(catalog)))
  })

  it('writes an overridden price as the price that actually applies', () => {
    // The sheet has no notion of a catalogue price plus an override, so what
    // goes in the cell is what the label shows.
    const { sheets } = readOds(catalogToOds(catalog))
    const { labels } = buildLabels(sheets)
    const pyramid = labels.find((entry) => entry.id === 'P-01')

    expect(pyramid?.extras[0]?.priceCents).toBe(13_900)
  })

  it('survives a second fold back into a catalogue', () => {
    // Export, reimport, export again: the shop will do this, and nothing may
    // drift on the way.
    const { sheets } = readOds(catalogToOds(catalog))
    const again = catalogFromLabels(buildLabels(sheets).labels).catalog

    expect(printable(resolveLabels(again))).toEqual(printable(resolveLabels(catalog)))
    expect(again.parts).toHaveLength(catalog.parts.length)
  })

  it('exports an empty catalogue as a usable template', () => {
    const { sheets, diagnostics } = readOds(catalogToOds({ products: [], parts: [] }))

    expect(diagnostics).toEqual([])
    expect(buildLabels(sheets).labels).toEqual([])
  })
})
