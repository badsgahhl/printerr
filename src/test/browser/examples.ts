import type { Label, LabelExtra } from '@/lib/types'

/**
 * The labels the screenshots are taken of.
 *
 * One entry per thing that can happen to a price tag in the shop, so that a
 * change to the layout has to face all of them at once: every optional text,
 * the exhibition price with its breakdown, the names and prices that do not
 * fit, and the small print that comes from the seller rather than from a
 * number.
 */

const label = (over: Partial<Label> & Pick<Label, 'id' | 'name' | 'priceCents'>): Label => ({
  subtitle: null,
  artNr: null,
  priceNote: null,
  note: null,
  copies: 1,
  preselected: true,
  layout: null,
  extras: [],
  sourceRow: 2,
  ...over
})

const extra = (over: Partial<LabelExtra> & Pick<LabelExtra, 'name'>): LabelExtra => ({
  artNr: null,
  priceCents: null,
  priceText: null,
  exhibited: false,
  ...over
})

export interface LabelExample {
  /** Becomes the screenshot's file name, so it stays short and stable. */
  readonly key: string
  readonly what: string
  readonly label: Label
  readonly brand?: string | null
}

export const LABEL_EXAMPLES: readonly LabelExample[] = [
  {
    key: 'bare',
    what: 'nothing but a name and a price',
    label: label({ id: 'bare', name: 'Räuchermann Bergmann', priceCents: 4990 })
  },
  {
    key: 'everything',
    what: 'every optional text at once',
    label: label({
      id: 'everything',
      name: 'Nussknacker Musketier 38 cm',
      subtitle: 'Dregeno · Erle, handbemalt',
      artNr: 'L024/070',
      priceCents: 15_900,
      priceNote: 'ohne Sockel',
      note: 'Ausgabe an der Kasse!'
    }),
    brand: 'Holzkunst Seiffen'
  },
  {
    key: 'exhibition',
    what: 'the exhibition price, with the base price moved into the breakdown',
    label: label({
      id: 'exhibition',
      name: 'Mühle "Seiffen"',
      subtitle: 'KWO',
      artNr: '4711',
      priceCents: 89_000,
      priceNote: 'ohne Figuren',
      extras: [
        extra({ name: 'Bergmann', artNr: '4712', priceCents: 12_900, exhibited: true }),
        extra({ name: 'Engel', artNr: '4713', priceCents: 12_900, exhibited: true })
      ]
    })
  },
  {
    key: 'breakdown-plain',
    what: 'add-ons that are listed but not on display',
    label: label({
      id: 'breakdown-plain',
      name: 'Pyramide 4-stöckig',
      subtitle: 'Seiffener Volkskunst',
      priceCents: 89_000,
      extras: [
        extra({ name: 'Bergmann', priceCents: 12_900 }),
        extra({ name: 'Engel', priceCents: 12_900 }),
        extra({ name: 'Kurrende', priceCents: 8900 })
      ]
    })
  },
  {
    key: 'breakdown-long',
    what: 'an add-on description that has to wrap to a second line',
    label: label({
      id: 'breakdown-long',
      name: 'Schwibbogen Seiffener Kirche',
      artNr: 'L100/12',
      priceCents: 24_950,
      extras: [
        extra({
          name: 'Komplettset (Stern + Außenbeleuchtung)',
          artNr: 'L100/13',
          priceCents: 4990,
          exhibited: true
        }),
        extra({ name: 'Sockel', priceCents: 1990, exhibited: true })
      ]
    })
  },
  {
    key: 'free-text-extra',
    what: 'an add-on priced in the seller own words rather than in cents',
    label: label({
      id: 'free-text-extra',
      name: 'Figurensatz nach Wahl',
      priceCents: 29_000,
      extras: [extra({ name: 'Einzelfiguren', priceText: 'ab 90,00 €' })]
    })
  },
  {
    key: 'long-name',
    what: 'a name long enough to be set smaller',
    label: label({
      id: 'long-name',
      name: 'Räuchermann Bergmann mit Laterne und Grubenlampe, große Ausführung',
      subtitle: 'Werkstatt Müller',
      artNr: 'RM-2201',
      priceCents: 13_900
    })
  },
  {
    key: 'big-price',
    what: 'a four-figure price, the widest the shop prints',
    label: label({ id: 'big-price', name: 'Weihnachtsberg', subtitle: 'Unikat', priceCents: 1_148_000 })
  },
  {
    key: 'small-price',
    what: 'a price of a few euros',
    label: label({ id: 'small-price', name: 'Streichholzschachtel-Engel', priceCents: 750 })
  },
  {
    key: 'whole-price',
    what: 'a price with no cents, for the shortened notation',
    label: label({ id: 'whole-price', name: 'Nussknacker König', subtitle: 'Dregeno', priceCents: 13_900 })
  },
  {
    key: 'price-only',
    what: 'nothing but a price, for a shelf where the piece speaks for itself',
    label: label({ id: 'price-only', name: '', priceCents: 1990 })
  },
  {
    key: 'no-name-but-the-rest',
    what: 'no name, but a maker and an article number',
    label: label({ id: 'no-name-but-the-rest', name: '', subtitle: 'Dregeno', artNr: 'L024/070', priceCents: 15_900 })
  },
  {
    key: 'note-and-brand',
    what: 'the foot alone: a hint and the shop name',
    label: label({
      id: 'note-and-brand',
      name: 'Spieldose',
      priceCents: 6800,
      note: 'Nur solange Vorrat reicht'
    }),
    brand: 'Holzkunst Seiffen'
  }
]

/**
 * What a sheet screenshot is filled with, named rather than taken by position.
 *
 * Every slot gets a different label, so a sheet shows the grid holding a short
 * name next to a long one and a plain price next to a breakdown. Naming them
 * keeps the sheets still when an example is added above: a new label variant
 * should cost one new screenshot, not a rewrite of every sheet.
 */
const SHEET_FILL: readonly string[] = [
  'everything',
  'exhibition',
  'long-name',
  'big-price',
  'bare',
  'breakdown-long',
  'price-only',
  'small-price'
]

/** As many labels as a sheet has slots, cycling through those. */
export function fillSheet(count: number): readonly Label[] {
  const pool = SHEET_FILL.map((key) => LABEL_EXAMPLES.find((example) => example.key === key)!.label)
  return Array.from({ length: count }, (_, index) => {
    const source = pool[index % pool.length]!
    return { ...source, id: `${source.id}-${index}` }
  })
}
