import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { Label, LabelExtra } from '@/lib/types'
import { DEFAULT_LABEL_STYLE } from '@/print/geometry'
import PriceLabel from '@/print/PriceLabel.vue'

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

/** Intl's no-break space varies with the ICU build; compare on normalised text. */
const textOf = (element: Element | null): string => (element?.textContent ?? '').replaceAll(/\s/gu, ' ').trim()

const priceOf = (container: Element): string => textOf(container.querySelector('.label__price-main'))

describe('PriceLabel, simple product', () => {
  it('shows name, subtitle, article number and price', () => {
    const { container } = render(PriceLabel, { props: { label: label({ priceCents: 8900 }) } })

    expect(screen.getByText('Mühle "Seiffen"')).toBeInTheDocument()
    expect(screen.getByText('KWO · Erle, handbemalt')).toBeInTheDocument()
    expect(screen.getByText('Art. 4711')).toBeInTheDocument()
    expect(priceOf(container)).toBe('89,00 €')
  })

  it('omits optional lines that carry no content', () => {
    const { container } = render(PriceLabel, {
      props: { label: label({ subtitle: null, artNr: null, note: null }) }
    })

    expect(container.querySelector('.label__subtitle')).toBeNull()
    expect(container.querySelector('.label__artnr')).toBeNull()
    expect(container.querySelector('.label__note')).toBeNull()
  })

  it('has no breakdown block when there is nothing to break down', () => {
    const { container } = render(PriceLabel, { props: { label: label() } })

    expect(container.querySelector('.label__breakdown')).toBeNull()
  })
})

describe('PriceLabel, exhibited piece', () => {
  const mill = label({
    priceCents: 89_000,
    priceNote: 'ohne Figuren',
    extras: [
      extra({ name: 'Bergmann', artNr: '4712', priceCents: 12_900, exhibited: true }),
      extra({ name: 'Engel', artNr: '4713', priceCents: 12_900, exhibited: true }),
      extra({ name: 'weitere Figuren', artNr: null, priceCents: null, priceText: 'ab 90,00 €' })
    ]
  })

  it('prints the price of the piece as it stands, not the base price', () => {
    const { container } = render(PriceLabel, { props: { label: mill } })

    expect(priceOf(container)).toBe('1.148,00 €')
    expect(textOf(container.querySelector('.label__price-suffix'))).toBe('wie ausgestellt')
  })

  it('lists the base price and every add-on underneath', () => {
    const { container } = render(PriceLabel, { props: { label: mill } })
    const rows = [...container.querySelectorAll('.label__row')].map((row) => textOf(row))

    expect(rows).toHaveLength(4)
    expect(rows[0]).toContain('ohne Figuren')
    expect(rows[0]).toContain('890,00 €')
    expect(rows[1]).toContain('Art. 4712')
    expect(rows.at(-1)).toContain('ab 90,00 €')
  })

  it('gives every breakdown row an article number column once one row has one', () => {
    // Claimed for all rows so the columns line up, even where the cell is empty.
    const { container } = render(PriceLabel, { props: { label: mill } })
    const cells = container.querySelectorAll('.label__row-artnr')

    expect(cells).toHaveLength(4)
    expect(textOf(cells[0] ?? null)).toBe('')
    expect(textOf(cells[1] ?? null)).toBe('Art. 4712')
  })

  it('omits the column entirely when no add-on has an article number', () => {
    const { container } = render(PriceLabel, {
      props: {
        label: label({ extras: [extra({ artNr: null, exhibited: true })] })
      }
    })

    expect(container.querySelectorAll('.label__row-artnr')).toHaveLength(0)
  })

  it('keeps the qualifier under the price when nothing is exhibited', () => {
    const { container } = render(PriceLabel, { props: { label: label({ priceNote: 'je Stück' }) } })

    expect(textOf(container.querySelector('.label__price-suffix'))).toBe('je Stück')
  })
})

describe('PriceLabel branding', () => {
  it('prints the shop name when one is given', () => {
    render(PriceLabel, { props: { label: label(), brand: 'Holzkunst Musterladen' } })

    expect(screen.getByText('Holzkunst Musterladen')).toBeInTheDocument()
  })

  it('leaves the foot empty when branding is switched off', () => {
    const { container } = render(PriceLabel, { props: { label: label(), brand: null } })

    expect(container.querySelector('.label__brand')).toBeNull()
  })
})

describe('PriceLabel sizing', () => {
  it('passes the label geometry to CSS in millimetres', () => {
    const { container } = render(PriceLabel, { props: { label: label() } })
    const style = container.querySelector('.label')?.getAttribute('style') ?? ''

    expect(style).toContain('--label-w: 105mm')
    expect(style).toContain('--label-h: 148.5mm')
  })

  it('applies fitted font sizes when measuring has produced them', () => {
    const { container } = render(PriceLabel, {
      props: { label: label(), fit: { name: 18.5, price: 42 } }
    })
    const style = container.querySelector('.label')?.getAttribute('style') ?? ''

    expect(style).toContain('--fs-name: 18.5px')
    expect(style).toContain('--fs-price: 42px')
  })

  it('renders without fitted sizes, so a label is never blank while measuring', () => {
    const { container } = render(PriceLabel, { props: { label: label() } })
    const style = container.querySelector('.label')?.getAttribute('style') ?? ''

    expect(style).not.toContain('--fs-name')
    expect(container.querySelector('.label__name')).toBeInTheDocument()
  })

  it('passes the chosen settings through to CSS', () => {
    const { container } = render(PriceLabel, {
      props: { label: label(), labelStyle: { ...DEFAULT_LABEL_STYLE, paddingMm: 12, nameMaxPx: 50 } }
    })
    const style = container.querySelector('.label')?.getAttribute('style') ?? ''

    expect(style).toContain('--label-pad: 12mm')

    // A bigger name maximum claims a taller head block. Read back rather than
    // recomputed, so the test does not duplicate the geometry it is checking.
    const nameHeight = Number(/--label-name-h: ([\d.]+)mm/u.exec(style)?.[1])
    expect(nameHeight).toBeGreaterThan(20)
  })

  it('keeps no room for a shop name it does not print', () => {
    const priceHeight = (props: Record<string, unknown>): number => {
      const { container, unmount } = render(PriceLabel, { props: { label: label(), ...props } })
      const style = container.querySelector('.label')?.getAttribute('style') ?? ''
      unmount()
      return Number(/--label-price-h: ([\d.]+)mm/u.exec(style)?.[1])
    }

    // Turning the shop-name size up must not move a label that has no shop name.
    const big = { ...DEFAULT_LABEL_STYLE, brandMaxPx: 26 }
    expect(priceHeight({ brand: null, labelStyle: big })).toBe(priceHeight({ brand: null }))

    expect(priceHeight({ brand: 'Holzkunst Musterladen' })).toBeLessThan(priceHeight({ brand: null }))
  })

  it('gives the price the height a shrunk hint no longer needs', () => {
    const priceHeight = (noteMaxPx: number, fit?: Record<string, number>): number => {
      const { container, unmount } = render(PriceLabel, {
        props: {
          label: label({ note: 'Ausgabe an der Kasse!' }),
          labelStyle: { ...DEFAULT_LABEL_STYLE, noteMaxPx },
          fit
        }
      })
      const style = container.querySelector('.label')?.getAttribute('style') ?? ''
      unmount()
      return Number(/--label-price-h: ([\d.]+)mm/u.exec(style)?.[1])
    }

    // Measured at 20px because that is as wide as the label allows: a higher
    // setting changes nothing about the text, so it must change nothing else.
    expect(priceHeight(34, { note: 20 })).toBe(priceHeight(24, { note: 20 }))
    // Before anything is measured the full size is kept free, as it always was.
    expect(priceHeight(34)).toBeLessThan(priceHeight(24))
  })

  it('reserves room for exactly as many breakdown rows as it prints', () => {
    const { container } = render(PriceLabel, {
      props: { label: label({ extras: [extra({ exhibited: true }), extra({ name: 'Engel', exhibited: true })] }) }
    })
    const style = container.querySelector('.label')?.getAttribute('style') ?? ''
    const rows = container.querySelectorAll('.label__row').length

    // Three rows: the base price plus the two add-ons.
    expect(rows).toBe(3)
    expect(style).toContain(`--label-breakdown-h: ${3 + 3 * 5.2}mm`)
  })
})
