import { describe, expect, it, vi } from 'vitest'

import { createAutoFit } from '@/composables/use-auto-fit'
import type { MeasureInput, TextMeasurer } from '@/lib/fit-text'
import type { Label, LabelExtra } from '@/lib/types'
import { DEFAULT_LABEL_STYLE } from '@/print/geometry'

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
    expect(Object.keys(fit ?? {}).sort()).toEqual([
      'artNr',
      'brand',
      'breakdownAmount',
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
    expect(fit?.subtitle).toBeUndefined()
    expect(fit?.brand).toBeUndefined()
    expect(fit?.name).toBeGreaterThan(0)
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

    expect(autoFit.fitFor('long')?.name).toBeLessThan(autoFit.fitFor('short')?.name ?? 0)
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
    const atDefault = autoFit.fitFor('big')?.price

    autoFit.ensureMeasured([label({ id: 'big' })], null, small)
    const atSmall = autoFit.fitFor('big')?.price

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
    expect(autoFit.fitFor('M-01')?.price).toBeLessThanOrEqual(50)
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
    expect(autoFit.fitFor('plain')?.price).not.toBe(autoFit.fitFor('exhibited')?.price)
  })
})
