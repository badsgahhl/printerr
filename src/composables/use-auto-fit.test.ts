import { describe, expect, it, vi } from 'vitest'

import { createAutoFit } from '@/composables/use-auto-fit'
import type { MeasureInput, TextMeasurer } from '@/lib/fit-text'
import { computePriceView } from '@/lib/price'
import type { Label, LabelExtra } from '@/lib/types'
import { amountColumnMm, DEFAULT_LABEL_STYLE, fontRanges, labelBoxes, labelContent } from '@/print/geometry'

/** Same model as lib/fit-text.test.ts: jsdom cannot measure anything for real. */
function fakeMeasurer(charWidthEm = 0.5): TextMeasurer {
  return ({ text, fontSizePx, maxWidthPx, wrap }: MeasureInput) => {
    const charWidth = fontSizePx * charWidthEm
    if (wrap === 'nowrap') {
      return { width: text.length * charWidth, height: fontSizePx * 1.2, overflowsWidth: false }
    }
    const perLine = Math.max(1, Math.floor(maxWidthPx / charWidth))
    const lines = Math.ceil(text.length / perLine)
    return {
      width: Math.min(maxWidthPx, text.length * charWidth),
      height: lines * fontSizePx * 1.2,
      overflowsWidth: false
    }
  }
}

const extra = (over: Partial<LabelExtra> = {}): LabelExtra => ({
  name: 'Bergmann',
  artNr: '4712',
  priceCents: 12_900,
  priceText: null,
  exhibited: true,
  ...over
})

const label = (over: Partial<Label> = {}): Label => ({
  id: 'M-01',
  name: 'Mühle "Seiffen"',
  subtitle: 'KWO · Erle, handbemalt',
  artNr: '4711',
  priceCents: 89_000,
  priceNote: 'ohne Figuren',
  note: 'Handarbeit aus dem Erzgebirge',
  copies: 1,
  preselected: true,
  layout: null,
  extras: [],
  sourceRow: 2,
  ...over
})

describe('auto fit', () => {
  it('produces a size for every text the label prints', () => {
    const autoFit = createAutoFit(fakeMeasurer())
    autoFit.ensureMeasured([label({ extras: [extra()] })], 'Holzkunst Musterladen')

    const fit = autoFit.fitFor('M-01')
    expect(Object.keys(fit?.sizes ?? {}).sort()).toEqual([
      'artNr',
      'brand',
      'breakdownAmount',
      'breakdownArtNr',
      'breakdownLabel',
      'name',
      'note',
      'price',
      'priceSuffix',
      'subtitle'
    ])
  })

  it('skips the styles a label has nothing to put in', () => {
    const autoFit = createAutoFit(fakeMeasurer())
    autoFit.ensureMeasured([label({ subtitle: null, artNr: null, note: null, priceNote: null })], null)

    const fit = autoFit.fitFor('M-01')
    expect(fit?.sizes.subtitle).toBeUndefined()
    expect(fit?.sizes.brand).toBeUndefined()
    expect(fit?.sizes.name).toBeGreaterThan(0)
  })

  it('measures each distinct text only once', () => {
    const measure = vi.fn<TextMeasurer>(fakeMeasurer())
    const autoFit = createAutoFit(measure)
    const labels = [label(), label({ id: 'M-02' })]

    autoFit.ensureMeasured(labels, null)
    const afterFirst = measure.mock.calls.length
    const cached = autoFit.cacheSize()

    autoFit.ensureMeasured(labels, null)

    // Two labels with identical text share every cache entry, and re-running
    // costs nothing -- which is what makes re-selecting and reordering cheap.
    expect(measure.mock.calls.length).toBe(afterFirst)
    expect(autoFit.cacheSize()).toBe(cached)
  })

  it('shrinks a long name rather than letting it run over', () => {
    const autoFit = createAutoFit(fakeMeasurer())
    autoFit.ensureMeasured(
      [
        label({ id: 'short', name: 'Engel' }),
        label({ id: 'long', name: 'Räuchermann Bergmann mit Laterne und Grubenlampe, große Ausführung' })
      ],
      null
    )

    expect(autoFit.fitFor('long')?.sizes.name).toBeLessThan(autoFit.fitFor('short')?.sizes.name ?? 0)
  })

  it('flags a label whose text cannot be made to fit', () => {
    // A very wide character model forces overflow even at the minimum size.
    const autoFit = createAutoFit(fakeMeasurer(20))
    autoFit.ensureMeasured([label({ name: 'Weihnachtspyramide vierstöckig' })], null)

    expect(autoFit.overflowing.value.has('M-01')).toBe(true)
  })

  it('reports nothing overflowing when everything fits', () => {
    const autoFit = createAutoFit(fakeMeasurer(0.1))
    autoFit.ensureMeasured([label()], null)

    expect(autoFit.overflowing.value.size).toBe(0)
  })

  it('re-measures after the embedded font has loaded', () => {
    // Measurements taken with fallback metrics are wrong and must be discarded.
    const measure = vi.fn<TextMeasurer>(fakeMeasurer())
    const autoFit = createAutoFit(measure)
    autoFit.ensureMeasured([label()], null)
    const before = measure.mock.calls.length

    autoFit.invalidate()
    expect(autoFit.cacheSize()).toBe(0)

    autoFit.ensureMeasured([label()], null)
    expect(measure.mock.calls.length).toBeGreaterThan(before)
  })

  it('follows the size settings', () => {
    const autoFit = createAutoFit(fakeMeasurer())
    const small = { ...DEFAULT_LABEL_STYLE, priceMaxPx: 40 }

    autoFit.ensureMeasured([label({ id: 'big' })], null, DEFAULT_LABEL_STYLE)
    const atDefault = autoFit.fitFor('big')?.sizes.price

    autoFit.ensureMeasured([label({ id: 'big' })], null, small)
    const atSmall = autoFit.fitFor('big')?.sizes.price

    expect(atSmall).toBeLessThan(atDefault ?? 0)
  })

  it('does not serve a cached size after the settings changed', () => {
    // The box can stay the same size while the allowed range moves, so the range
    // has to be part of the cache key -- otherwise a slider would do nothing.
    const measure = vi.fn<TextMeasurer>(fakeMeasurer())
    const autoFit = createAutoFit(measure)

    autoFit.ensureMeasured([label()], null, DEFAULT_LABEL_STYLE)
    const before = measure.mock.calls.length

    autoFit.ensureMeasured([label()], null, { ...DEFAULT_LABEL_STYLE, priceMaxPx: 50 })

    expect(measure.mock.calls.length).toBeGreaterThan(before)
    expect(autoFit.fitFor('M-01')?.sizes.price).toBeLessThanOrEqual(50)
  })

  it('fits the price into the height a shrunk text gave back', () => {
    // A hint turned up further than the label is wide: it shrinks to the width
    // and hands back the height it no longer needs.
    const style = { ...DEFAULT_LABEL_STYLE, noteMaxPx: 34 }
    const noted = label({ note: 'Ausgabe an der Kasse! Bitte beim Personal melden.' })
    const view = computePriceView(noted)

    const probe = createAutoFit(fakeMeasurer())
    probe.ensureMeasured([noted], null, style)
    const before = labelBoxes(labelContent(noted, view, null), style).price.height
    const after = labelBoxes(labelContent(noted, view, null, probe.fitFor(noted.id)), style).price.height
    expect(after).toBeGreaterThan(before)

    // A face tall enough that the full-size price only fits into the room the
    // hint gave back, not into the room it had before.
    const priceMax = fontRanges(style).price.maxPx
    const heightPerPx = (before + after) / 2 / priceMax
    const measure = fakeMeasurer()
    const autoFit = createAutoFit((input) =>
      input.styleKey === 'price' ? { ...measure(input), height: input.fontSizePx * heightPerPx } : measure(input)
    )
    autoFit.ensureMeasured([noted], null, style)

    expect(autoFit.fitFor(noted.id)?.sizes.price).toBe(priceMax)
    expect(autoFit.overflowing.value.has(noted.id)).toBe(false)
  })

  describe('add-on rows', () => {
    const lamp = extra({ name: 'Außenbeleuchtung', artNr: null, priceCents: 3020, exhibited: false })
    const set = extra({
      name: 'Komplettset (Stern + Außenbeleuchtung)',
      artNr: null,
      priceCents: 9630,
      exhibited: false
    })
    const style = { ...DEFAULT_LABEL_STYLE, breakdownMaxPx: 16 }

    it('wraps a long description instead of holding every row small', () => {
      const autoFit = createAutoFit(fakeMeasurer())
      autoFit.ensureMeasured([label({ id: 'stern', extras: [lamp, set] })], null, style)
      const fit = autoFit.fitFor('stern')

      expect(fit?.sizes.breakdownLabel).toBe(fontRanges(style).breakdownLabel.maxPx)
      expect(fit?.breakdownLines).toEqual([1, 2])
      expect(autoFit.overflowing.value.has('stern')).toBe(false)
    })

    it('shrinks every description together once one will not fit even on two lines', () => {
      // Three lines at full size, two once it is somewhat smaller.
      const endless = extra({ name: 'Figurengruppe '.repeat(6).trim(), artNr: null, exhibited: false })
      const autoFit = createAutoFit(fakeMeasurer())
      autoFit.ensureMeasured([label({ id: 'lang', extras: [lamp, endless] })], null, style)
      const fit = autoFit.fitFor('lang')

      expect(fit?.sizes.breakdownLabel).toBeLessThan(fontRanges(style).breakdownLabel.maxPx)
      expect(fit?.breakdownLines).toEqual([1, 2])
      expect(autoFit.overflowing.value.has('lang')).toBe(false)
    })

    it('narrows the amount column to what the amounts need', () => {
      const star = label({ id: 'stern', extras: [lamp, set] })
      const autoFit = createAutoFit(fakeMeasurer())
      autoFit.ensureMeasured([star], null, style)
      const view = computePriceView(star)

      // "96,30 €" is seven characters of half an em at 16px.
      expect(autoFit.fitFor('stern')?.amountWidthPx).toBe(7 * 0.5 * 16)
      expect(amountColumnMm(labelContent(star, view, null, autoFit.fitFor('stern')), style)).toBeLessThan(
        amountColumnMm(labelContent(star, view, null), style)
      )
    })

    it('gives the article numbers a size and a column of their own', () => {
      const autoFit = createAutoFit(fakeMeasurer())
      autoFit.ensureMeasured([label({ extras: [extra({ exhibited: false })] })], null, style)
      const fit = autoFit.fitFor('M-01')

      // Its own range, not the description's: the numbers are set a size smaller.
      const range = fontRanges(style).breakdownArtNr
      expect(fit?.sizes.breakdownArtNr).toBeGreaterThanOrEqual(range.minPx)
      expect(fit?.sizes.breakdownArtNr).toBeLessThanOrEqual(range.maxPx)
      expect(fit?.artNrWidthPx).toBeGreaterThan(0)
    })
  })

  it('gives the exhibition price its own size, separate from the base price', () => {
    const autoFit = createAutoFit(fakeMeasurer())
    autoFit.ensureMeasured(
      [
        label({ id: 'plain', extras: [] }),
        label({ id: 'exhibited', extras: [extra(), extra({ name: 'Engel', artNr: '4713' })] })
      ],
      null
    )

    // The exhibited label has a breakdown block, which leaves less room for the
    // price -- so the two must not share a cache entry.
    expect(autoFit.fitFor('plain')?.sizes.price).not.toBe(autoFit.fitFor('exhibited')?.sizes.price)
  })
})
