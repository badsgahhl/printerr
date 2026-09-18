import { describe, expect, it } from 'vitest'

import type { RawCell, RawSheet } from '@/lib/ods/read-ods'
import { computePriceView } from '@/lib/price'
import { buildLabels } from '@/lib/schema/build-labels'
import { EXTRA_HEADERS, PRODUCT_HEADERS } from '@/lib/schema/columns'

const text = (value: string): RawCell => ({ text: value, number: null })
const number = (value: number): RawCell => ({ text: String(value), number: value })
const blank: RawCell = { text: '', number: null }

const headerRow = (headings: readonly string[]): RawCell[] => headings.map((heading) => text(heading))

/** ID, Name, Untertitel, ArtNr, Preis, Preiszusatz, Hinweis, Anzahl, Drucken, Layout */
const products = (rows: readonly RawCell[][], headings: readonly string[] = PRODUCT_HEADERS): RawSheet => ({
  name: 'Produkte',
  rows: [headerRow(headings), ...rows]
})

/** ProduktID, Bezeichnung, ArtNr, Preis, Preistext, Ausgestellt */
const extras = (rows: readonly RawCell[][], headings: readonly string[] = EXTRA_HEADERS): RawSheet => ({
  name: 'Zusätze',
  rows: [headerRow(headings), ...rows]
})

const codes = (result: { diagnostics: readonly { code: string }[] }): string[] =>
  result.diagnostics.map((diagnostic) => diagnostic.code)

describe('buildLabels, the simple case', () => {
  it('reads a plain product row', () => {
    const { labels, diagnostics } = buildLabels([
      products([[text('R-01'), text('Räuchermann Bergmann'), text('KWO · Erle'), text('6011'), number(89)]])
    ])

    expect(diagnostics).toEqual([])
    expect(labels).toHaveLength(1)
    expect(labels[0]).toMatchObject({
      id: 'R-01',
      name: 'Räuchermann Bergmann',
      subtitle: 'KWO · Erle',
      artNr: '6011',
      priceCents: 8900,
      copies: 1,
      preselected: true,
      extras: [],
      sourceRow: 2
    })
  })

  it('defaults Anzahl to one and Drucken to selected', () => {
    const { labels } = buildLabels([products([[text('A'), text('Engel'), blank, blank, number(42.5)]])])

    expect(labels[0]?.copies).toBe(1)
    expect(labels[0]?.preselected).toBe(true)
    expect(labels[0]?.priceCents).toBe(4250)
  })

  it('honours Anzahl and Drucken when given', () => {
    const { labels } = buildLabels([
      products([
        [text('E-01'), text('Engel'), blank, blank, number(42.5), blank, blank, number(2), text('ja')],
        [text('N-01'), text('Nussknacker'), blank, blank, number(179), blank, blank, blank, text('nein')]
      ])
    ])

    expect(labels[0]?.copies).toBe(2)
    expect(labels[0]?.preselected).toBe(true)
    expect(labels[1]?.preselected).toBe(false)
  })

  it('accepts a price typed as text', () => {
    const { labels, diagnostics } = buildLabels([
      products([[text('A'), text('Engel'), blank, blank, text('1.148,00 €')]])
    ])

    expect(diagnostics).toEqual([])
    expect(labels[0]?.priceCents).toBe(114_800)
  })
})

describe('buildLabels, the exhibition case', () => {
  it('builds the Mühle from the plan and totals it correctly', () => {
    const { labels, diagnostics } = buildLabels([
      products([
        [text('M-01'), text('Mühle "Seiffen"'), text('KWO · Erle'), text('4711'), number(890), text('ohne Figuren')]
      ]),
      extras([
        [text('M-01'), text('Bergmann'), text('4712'), number(129), blank, text('ja')],
        [text('M-01'), text('Engel'), text('4713'), number(129), blank, text('ja')],
        [text('M-01'), text('weitere Figuren'), blank, blank, text('ab 90,00 €'), text('nein')]
      ])
    ])

    expect(diagnostics).toEqual([])
    expect(labels[0]?.extras).toHaveLength(3)

    const view = computePriceView(labels[0]!)
    expect(view.mode).toBe('exhibition')
    expect(view.mainCents).toBe(114_800)
    expect(view.breakdown[0]?.label).toBe('ohne Figuren')
    expect(view.breakdown.at(-1)?.amountText).toBe('ab 90,00 €')
  })

  it('keeps add-ons in sheet order', () => {
    const { labels } = buildLabels([
      products([[text('P-01'), text('Pyramide'), blank, blank, number(1290)]]),
      extras([
        [text('P-01'), text('Figuren'), blank, number(180), blank, text('ja')],
        [text('P-01'), text('Teelichter'), blank, number(24), blank, text('ja')]
      ])
    ])

    expect(labels[0]?.extras.map((extra) => extra.name)).toEqual(['Figuren', 'Teelichter'])
    expect(computePriceView(labels[0]!).mainCents).toBe(149_400)
  })

  it('flags an exhibited add-on without a price and leaves the label unselected', () => {
    // The PAngV rule: the piece on display has to be able to state a final price.
    const result = buildLabels([
      products([[text('M-01'), text('Mühle'), blank, blank, number(890)]]),
      extras([[text('M-01'), text('Figuren'), blank, blank, text('ab 90,00 €'), text('ja')]])
    ])

    expect(codes(result)).toContain('exhibited-without-price')
    expect(result.labels[0]?.preselected).toBe(false)
    // Still importable -- the seller decides whether to print it anyway.
    expect(result.labels).toHaveLength(1)
  })

  it('does not flag an unpriced add-on that is not on display', () => {
    const result = buildLabels([
      products([[text('S-01'), text('Schwibbogen'), blank, blank, number(149)]]),
      extras([[text('S-01'), text('Ersatzkerzen'), blank, blank, text('ab 4,90 €'), text('nein')]])
    ])

    expect(codes(result)).toEqual([])
    expect(result.labels[0]?.preselected).toBe(true)
  })
})

describe('buildLabels diagnostics', () => {
  it('rejects a duplicate ID and names the first occurrence', () => {
    const result = buildLabels([
      products([
        [text('A'), text('Erste'), blank, blank, number(10)],
        [text('A'), text('Zweite'), blank, blank, number(20)]
      ])
    ])

    expect(codes(result)).toEqual(['duplicate-id'])
    expect(result.diagnostics[0]?.message).toContain('Zeile 2')
    expect(result.labels).toHaveLength(1)
  })

  it('rejects a row without an ID', () => {
    const result = buildLabels([products([[blank, text('Namenlos'), blank, blank, number(10)]])])

    expect(codes(result)).toEqual(['missing-id'])
    expect(result.labels).toEqual([])
  })

  it('rejects a row without a name', () => {
    const result = buildLabels([products([[text('A'), blank, blank, blank, number(10)]])])

    expect(codes(result)).toEqual(['missing-name'])
  })

  it('distinguishes a missing price from an unreadable one', () => {
    const missing = buildLabels([products([[text('A'), text('Engel'), blank, blank, blank]])])
    expect(missing.diagnostics[0]?.message).toContain('keinen Preis')

    const broken = buildLabels([products([[text('B'), text('Engel'), blank, blank, text('auf Anfrage')]])])
    expect(broken.diagnostics[0]?.message).toContain('kein gültiger Preis')
    expect(codes(broken)).toEqual(['bad-price'])
  })

  it('reports add-ons pointing at a product that does not exist', () => {
    const result = buildLabels([
      products([[text('A'), text('Engel'), blank, blank, number(10)]]),
      extras([[text('TIPPFEHLER'), text('Figur'), blank, number(5), blank, text('nein')]])
    ])

    expect(codes(result)).toContain('unknown-product')
    expect(result.diagnostics.at(-1)?.message).toContain('TIPPFEHLER')
  })

  it('steers a free-text price in the Preis column to the right column', () => {
    const result = buildLabels([
      products([[text('A'), text('Mühle'), blank, blank, number(890)]]),
      extras([[text('A'), text('Figuren'), blank, text('ab 90'), blank, text('nein')]])
    ])

    expect(codes(result)).toContain('bad-price')
    expect(result.diagnostics[0]?.message).toContain('Preistext')
  })

  it('names every missing required column at once', () => {
    const result = buildLabels([products([[text('A')]], ['Kennung', 'Irgendwas'])])

    expect(codes(result)).toEqual(['missing-column'])
    expect(result.diagnostics[0]?.message).toContain('„Name"')
    expect(result.diagnostics[0]?.message).toContain('„Preis"')
    expect(result.diagnostics[0]?.message).not.toContain('„ID"')
  })

  it('reports a file without a Produkte sheet and lists what it did find', () => {
    const result = buildLabels([
      { name: 'Umsatz', rows: [[text('x')]] },
      { name: 'Notizen', rows: [[text('y')]] }
    ])

    expect(codes(result)).toEqual(['missing-sheet'])
    expect(result.diagnostics[0]?.message).toContain('„Umsatz"')
    expect(result.labels).toEqual([])
  })
})

describe('buildLabels tolerance', () => {
  it('matches headings regardless of case, spacing and umlaut spelling', () => {
    const { labels, diagnostics } = buildLabels([
      products(
        [[text('A'), text('Engel'), blank, text('4711'), number(42)]],
        ['id', 'BEZEICHNUNG', 'Hersteller', 'Art.-Nr.', 'VK']
      ),
      {
        name: 'Zusaetze',
        rows: [
          headerRow(['Produkt ID', 'Position', 'Artikelnummer', 'Betrag', 'Preisangabe', 'In Ausstellung']),
          [text('A'), text('Figur'), text('4712'), number(9), blank, text('ja')]
        ]
      }
    ])

    expect(diagnostics).toEqual([])
    expect(labels[0]?.artNr).toBe('4711')
    expect(labels[0]?.extras[0]?.name).toBe('Figur')
    expect(labels[0]?.extras[0]?.exhibited).toBe(true)
  })

  it('finds the heading row below a title line', () => {
    const { labels, diagnostics } = buildLabels([
      {
        name: 'Produkte',
        rows: [
          [text('Preisliste Frühjahr')],
          [],
          headerRow(PRODUCT_HEADERS),
          [text('A'), text('Engel'), blank, blank, number(42)]
        ]
      }
    ])

    expect(diagnostics).toEqual([])
    expect(labels[0]?.sourceRow).toBe(4)
  })

  it('falls back to the only sheet when none is named Produkte', () => {
    const result = buildLabels([
      { name: 'Tabelle', rows: [headerRow(PRODUCT_HEADERS), [text('A'), text('Engel'), blank, blank, number(42)]] }
    ])

    expect(codes(result)).toEqual(['missing-sheet'])
    expect(result.diagnostics[0]?.severity).toBe('warning')
    expect(result.labels).toHaveLength(1)
  })

  it('skips blank rows in the middle of the table', () => {
    const { labels, diagnostics } = buildLabels([
      products([
        [text('A'), text('Engel'), blank, blank, number(42)],
        [],
        [text('B'), text('Mühle'), blank, blank, number(890)]
      ])
    ])

    expect(diagnostics).toEqual([])
    expect(labels.map((label) => label.sourceRow)).toEqual([2, 4])
  })
})
