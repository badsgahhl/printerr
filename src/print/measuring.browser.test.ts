import { afterEach, describe, expect, it } from 'vitest'

import { createAutoFit } from '@/composables/use-auto-fit'
import { createDomMeasurer } from '@/infra/dom-measurer'
import { DEFAULT_LABEL_STYLE } from '@/print/geometry'
import { LABEL_EXAMPLES } from '@/test/browser/examples'
import { labelFontReady, printMedia, renderLabel, screenMedia } from '@/test/browser/harness'

import '@/assets/fonts.css'
import '@/print/label.css'
import '@/print/print.css'

/*
 * The measuring sandbox, in the only place it can be tested.
 *
 * Everything the app prints is sized by this: jsdom answers every measurement
 * with zero, so the jsdom suite has to inject a fake measurer and can only
 * check the arithmetic around it. Here it is the real one.
 */

afterEach(() => screenMedia())

const example = (key: string) => LABEL_EXAMPLES.find((entry) => entry.key === key)!.label

describe('the measuring sandbox', () => {
  it('measures text, which is the whole thing jsdom cannot do', async () => {
    await labelFontReady()
    const measurer = createDomMeasurer()

    const short = measurer.measure({ text: '9 €', fontSizePx: 40, maxWidthPx: 1000, wrap: 'nowrap', styleKey: 'price' })
    const long = measurer.measure({
      text: '1.148,00 €',
      fontSizePx: 40,
      maxWidthPx: 1000,
      wrap: 'nowrap',
      styleKey: 'price'
    })

    expect(short.width).toBeGreaterThan(0)
    expect(long.width).toBeGreaterThan(short.width)
    // Tabular figures at 40px: a ten-character price is well over 150px wide.
    expect(long.width).toBeGreaterThan(150)

    measurer.dispose()
  })

  it('says so when print has hidden it', async () => {
    const measurer = createDomMeasurer()
    expect(measurer.usable()).toBe(true)

    await printMedia()
    expect(measurer.usable()).toBe(false)

    await screenMedia()
    expect(measurer.usable()).toBe(true)

    measurer.dispose()
  })

  it('uses the embedded face, not a fallback with different metrics', async () => {
    await labelFontReady()

    expect(document.fonts.check('600 16px "Source Serif 4"')).toBe(true)
  })
})

describe('the sizes a label was given', () => {
  it('survive the round that print asks for while the sandbox is hidden', async () => {
    // Switching to print makes Chromium reload the face, which asks auto-fit
    // for a fresh round -- with the sandbox hidden, so every text would measure
    // as nothing and every label would come back at the top of its slider.
    await labelFontReady()
    const labels = [example('everything'), example('exhibition')]
    const measurer = createDomMeasurer()
    const autoFit = createAutoFit(measurer.measure, () => measurer.usable())
    autoFit.ensureMeasured(labels, 'Holzkunst Seiffen', DEFAULT_LABEL_STYLE)

    const before = labels.map((label) => autoFit.fitFor(label.id))
    expect(before[0]?.sizes.price).toBeGreaterThan(0)

    await printMedia()
    autoFit.invalidate()
    autoFit.ensureMeasured(labels, 'Holzkunst Seiffen', DEFAULT_LABEL_STYLE)

    expect(labels.map((label) => autoFit.fitFor(label.id))).toEqual(before)

    measurer.dispose()
  })

  it('keep the add-on columns, which once collapsed to a hairline on paper', async () => {
    const { screen } = await renderLabel(example('exhibition'))
    const label = screen.container.querySelector<HTMLElement>('.label')!
    const amountMm = () => Number.parseFloat(getComputedStyle(label).getPropertyValue('--label-amount-w'))
    const onScreen = amountMm()

    expect(onScreen).toBeGreaterThan(5)

    await printMedia()

    // The column is as wide as its widest amount, measured once. It has no
    // business changing because the page went to the printer.
    expect(amountMm()).toBe(onScreen)
    expect(screen.container.querySelector('.label__row-amount')!.clientWidth).toBeGreaterThan(20)
  })
})
