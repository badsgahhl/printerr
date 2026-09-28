import { afterEach, describe, expect, it } from 'vitest'

import { DEFAULT_LABEL_STYLE, type LabelStyle, punchHeightMm } from '@/print/geometry'
import { LABEL_EXAMPLES } from '@/test/browser/examples'
import { fitsFor, printMedia, renderLabel, screenMedia } from '@/test/browser/harness'

import '@/assets/fonts.css'
import '@/print/label.css'
import '@/print/print.css'

/*
 * The settings a shop reaches for, each shown on a real label.
 *
 * What makes these browser tests rather than geometry tests: every one of them
 * is about a size that only exists once the text has been measured -- how large
 * the price ends up, and where it sits once it is that large.
 */

afterEach(() => screenMedia())

const styled = (over: Partial<LabelStyle>): LabelStyle => ({ ...DEFAULT_LABEL_STYLE, ...over })
const MM = 96 / 25.4

const example = (key: string) => LABEL_EXAMPLES.find((entry) => entry.key === key)!.label

describe('the hole for the ribbon', () => {
  it('pushes the text down by exactly the strip it reserves', async () => {
    const style = styled({ punchMm: 10 })
    const { locator, screen } = await renderLabel(example('everything'), { style, brand: 'Holzkunst Seiffen' })
    const label = screen.container.querySelector<HTMLElement>('.label')!

    const padding = Number.parseFloat(getComputedStyle(label).paddingTop) / MM
    expect(padding).toBeCloseTo(DEFAULT_LABEL_STYLE.paddingMm + 10, 1)

    await printMedia()
    await expect.element(locator).toMatchScreenshot('hole-10mm')
  })

  it('takes no more than a third of the smallest label', async () => {
    // Twenty millimetres would be more than half of a sixty-fourth of A4.
    const style = styled({ columns: 8, rows: 8, punchMm: 20 })
    const { locator, screen } = await renderLabel(example('bare'), { style })
    const label = screen.container.querySelector<HTMLElement>('.label')!

    const padding = Number.parseFloat(getComputedStyle(label).paddingTop) / MM
    expect(punchHeightMm(style)).toBeCloseTo(12.375, 3)
    expect(padding).toBeCloseTo(punchHeightMm(style) + Number.parseFloat(getComputedStyle(label).paddingLeft) / MM, 1)
    expect(label.scrollHeight).toBeLessThanOrEqual(label.clientHeight + 1)

    await printMedia()
    await expect.element(locator).toMatchScreenshot('hole-capped-on-a-64th')
  })
})

describe('where the price stands', () => {
  /** 0 is against the text above, 1 is on the floor of the price block. */
  const priceAt = (container: HTMLElement): number => {
    const block = container.querySelector<HTMLElement>('.label__price')!.getBoundingClientRect()
    const text = container.querySelector<HTMLElement>('.label__price-main')!.getBoundingClientRect()
    return Number(((text.top - block.top) / (block.height - text.height)).toFixed(2))
  }

  it.each([
    ['top', 0, 0],
    ['middle', 50, 0.5],
    ['bottom', 100, 1]
  ])('puts the price at the %s of its room', async (where, pricePosPct, expected) => {
    const { locator, screen } = await renderLabel(example('bare'), { style: styled({ pricePosPct }) })

    expect(priceAt(screen.container)).toBeCloseTo(expected, 1)

    await printMedia()
    await expect.element(locator).toMatchScreenshot(`price-${where}`)
  })

  it('does not resize the price by moving it', async () => {
    const [middle, bottom] = await Promise.all([
      fitsFor([example('big-price')], { style: styled({ pricePosPct: 50 }) }),
      fitsFor([example('big-price')], { style: styled({ pricePosPct: 100 }) })
    ])

    expect(bottom.get('big-price')!.sizes.price).toBe(middle.get('big-price')!.sizes.price)
  })
})

describe('a price with no cents', () => {
  it('is written with a dash and set larger for it', async () => {
    const label = example('whole-price')
    // With the slider at its default the price is already as large as the
    // setting allows, and there is nothing for the shorter text to win. Turned
    // up, the width is what limits it -- which is what the dash buys back.
    const style = styled({ priceMaxPx: 220 })
    const [withCents, shortened] = await Promise.all([
      fitsFor([label], { style }),
      fitsFor([label], { style, priceFormat: { shortenWholePrices: true } })
    ])

    // Three characters fewer is room the fitting pass gives straight back.
    expect(shortened.get(label.id)!.sizes.price!).toBeGreaterThan(withCents.get(label.id)!.sizes.price! * 1.1)

    const { locator, screen } = await renderLabel(label, {
      style: styled({ columns: 4, rows: 4, priceMaxPx: 220 }),
      priceFormat: { shortenWholePrices: true }
    })
    expect(screen.container.querySelector('.label__price-main')!.textContent).toMatch(/^139,–/u)

    await printMedia()
    await expect.element(locator).toMatchScreenshot('price-shortened')
  })

  it('shortens the breakdown with the big price, so the label reads as one', async () => {
    const { screen } = await renderLabel(example('exhibition'), { priceFormat: { shortenWholePrices: true } })

    expect(screen.container.querySelector('.label__price-main')!.textContent).toMatch(/^1\.148,–/u)
    expect([...screen.container.querySelectorAll('.label__row-amount')].map((cell) => cell.textContent)).toEqual([
      expect.stringMatching(/^890,–/u),
      expect.stringMatching(/^129,–/u),
      expect.stringMatching(/^129,–/u)
    ])
  })

  it('leaves a price that has cents alone', async () => {
    // The exhibition sum of 249,50 + 49,90 + 19,90 is not a whole number of
    // euros, so nothing about it is shortened.
    const { screen } = await renderLabel(example('breakdown-long'), {
      priceFormat: { shortenWholePrices: true }
    })

    expect(screen.container.querySelector('.label__price-main')!.textContent).toMatch(/^319,30/u)
  })
})

describe('how large the price can be set', () => {
  it('reaches further than the slider used to allow', async () => {
    // On a label wider than it is tall the old ceiling of 110 was the limit,
    // not the room: the price stopped growing with two thirds of its block
    // still empty.
    const label = example('bare')
    const wide = { columns: 2, rows: 4 }
    const [old, raised] = await Promise.all([
      fitsFor([label], { style: styled({ ...wide, priceMaxPx: 110 }) }),
      fitsFor([label], { style: styled({ ...wide, priceMaxPx: 220 }) })
    ])

    expect(raised.get(label.id)!.sizes.price!).toBeGreaterThan(old.get(label.id)!.sizes.price! * 1.3)
  })

  it('still stops where the label stops', async () => {
    const style = styled({ columns: 4, rows: 4, priceMaxPx: 220 })
    const { screen } = await renderLabel(example('big-price'), { style })
    const label = screen.container.querySelector<HTMLElement>('.label')!

    expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth + 1)
    expect(label.scrollHeight).toBeLessThanOrEqual(label.clientHeight + 1)
  })
})
