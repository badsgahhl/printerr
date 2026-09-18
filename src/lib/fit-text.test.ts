import { describe, expect, it } from 'vitest'

import {
  type FitBox,
  type FitRequest,
  fitText,
  type MeasureInput,
  measureBudget,
  type TextMeasurer
} from '@/lib/fit-text'

interface FakeOptions {
  /** Width of one character as a fraction of the font size. */
  readonly charWidthEm?: number
  readonly lineHeightEm?: number
}

/**
 * A deterministic stand-in for real text measurement.
 *
 * jsdom has no layout engine -- every real measurement there is zero -- so the
 * search is tested against a model with greedy word wrapping instead.
 */
function createFakeMeasurer(options: FakeOptions = {}): TextMeasurer {
  const charWidthEm = options.charWidthEm ?? 0.5
  const lineHeightEm = options.lineHeightEm ?? 1.2

  return ({ text, fontSizePx, maxWidthPx, wrap }: MeasureInput) => {
    const charWidth = fontSizePx * charWidthEm
    const lineHeight = fontSizePx * lineHeightEm
    const widthOf = (word: string): number => word.length * charWidth

    if (wrap === 'nowrap') {
      return { width: widthOf(text), height: lineHeight, overflowsWidth: false }
    }

    const words = text.split(' ').filter((word) => word.length > 0)
    if (words.length === 0) return { width: 0, height: lineHeight, overflowsWidth: false }

    const longestWord = Math.max(...words.map((word) => widthOf(word)))
    let lines = 1
    let current = 0
    let widest = 0

    for (const word of words) {
      const candidate = current === 0 ? widthOf(word) : current + charWidth + widthOf(word)
      if (candidate <= maxWidthPx) {
        current = candidate
      } else {
        widest = Math.max(widest, current)
        lines += 1
        current = widthOf(word)
      }
    }
    widest = Math.max(widest, current)

    return { width: widest, height: lines * lineHeight, overflowsWidth: longestWord > maxWidthPx }
  }
}

const box = (width: number, height: number): FitBox => ({ width, height })

const request = (over: Partial<FitRequest> = {}): FitRequest => ({
  text: 'Engel',
  box: box(200, 60),
  styleKey: 'name',
  wrap: 'wrap',
  minPx: 6,
  maxPx: 30,
  ...over
})

/** Does this exact size fit, according to the same fake the search used? */
const fitsAt = (req: FitRequest, measure: TextMeasurer, fontSizePx: number): boolean => {
  const safety = req.safetyPx ?? 0.5
  const measurement = measure({
    text: req.text,
    fontSizePx,
    maxWidthPx: req.wrap === 'wrap' ? req.box.width - safety : Number.POSITIVE_INFINITY,
    wrap: req.wrap,
    styleKey: req.styleKey
  })
  return (
    !measurement.overflowsWidth &&
    measurement.width <= req.box.width - safety + 0.01 &&
    measurement.height <= req.box.height - safety + 0.01
  )
}

describe('fitText when the text already fits', () => {
  it('keeps the maximum size and measures exactly once', () => {
    const measure = createFakeMeasurer()
    const result = fitText(request({ text: 'Engel' }), measure)

    expect(result.fontSizePx).toBe(30)
    expect(result.status).toBe('fits')
    expect(result.measureCalls).toBe(1)
  })

  it('handles empty text', () => {
    const result = fitText(request({ text: '' }), createFakeMeasurer())

    expect(result.status).toBe('fits')
    expect(result.fontSizePx).toBe(30)
  })
})

describe('fitText when the text has to shrink', () => {
  const longName = 'Räuchermann Bergmann mit Laterne und Grubenlampe, groß'

  it('reports shrunk and stays inside the range', () => {
    const result = fitText(request({ text: longName }), createFakeMeasurer())

    expect(result.status).toBe('shrunk')
    expect(result.fontSizePx).toBeGreaterThanOrEqual(6)
    expect(result.fontSizePx).toBeLessThan(30)
  })

  it('lands on the step grid', () => {
    const measure = createFakeMeasurer()
    const req = request({ text: longName, stepPx: 0.5 })
    const result = fitText(req, measure)

    expect(((result.fontSizePx - req.minPx) / 0.5) % 1).toBe(0)
  })

  it('finds the largest size that still fits', () => {
    // The point of the whole exercise: not merely a fitting size, the best one.
    const measure = createFakeMeasurer()
    const req = request({ text: longName, stepPx: 0.5 })
    const result = fitText(req, measure)

    expect(fitsAt(req, measure, result.fontSizePx)).toBe(true)
    expect(fitsAt(req, measure, result.fontSizePx + 0.5)).toBe(false)
  })

  it('stays within its measurement budget', () => {
    // Guards the performance assumption, not just correctness: a regression to a
    // linear scan would still produce the right answer, just far too slowly.
    const req = request({ text: longName, minPx: 6, maxPx: 30, stepPx: 0.5 })
    const result = fitText(req, createFakeMeasurer())

    expect(result.measureCalls).toBeLessThanOrEqual(measureBudget(req))
    expect(measureBudget(req)).toBeLessThanOrEqual(8)
  })
})

describe('fitText when nothing fits', () => {
  it('falls back to the minimum and says so', () => {
    // One unbreakable word wider than the box at any size.
    const result = fitText(
      request({ text: 'Weihnachtspyramidenfigurenensemble', box: box(40, 60), minPx: 6, maxPx: 30 }),
      createFakeMeasurer()
    )

    expect(result.status).toBe('overflow')
    expect(result.fontSizePx).toBe(6)
  })

  it('reports overflow for a single line that cannot be shrunk far enough', () => {
    const result = fitText(
      request({ text: '1.148,00 €', wrap: 'nowrap', box: box(5, 40), minPx: 6, maxPx: 30 }),
      createFakeMeasurer()
    )

    expect(result.status).toBe('overflow')
    expect(result.fontSizePx).toBe(6)
  })
})

describe('fitText on single-line text', () => {
  it('shrinks a long price to fit its width', () => {
    const measure = createFakeMeasurer()
    const req = request({ text: '1.148,00 €', wrap: 'nowrap', box: box(60, 40), minPx: 6, maxPx: 30 })
    const result = fitText(req, measure)

    expect(result.status).toBe('shrunk')
    expect(fitsAt(req, measure, result.fontSizePx)).toBe(true)
  })

  it('gets there in far fewer measurements than a search would need', () => {
    // Width is linear in font size, so an estimate plus a check is enough.
    const req = request({ text: '1.148,00 €', wrap: 'nowrap', box: box(60, 40), minPx: 6, maxPx: 30 })
    const result = fitText(req, createFakeMeasurer())

    expect(result.measureCalls).toBeLessThanOrEqual(4)
  })
})

describe('the fake measurer itself', () => {
  it('is monotonic in font size, as the binary search assumes', () => {
    // Without this the search would be tested against a model that breaks its
    // own precondition, and a passing suite would prove nothing.
    const measure = createFakeMeasurer()
    const req = request({ text: 'Weihnachtspyramide vierstöckig mit Bergparade', stepPx: 0.5 })

    const outcomes: boolean[] = []
    for (let size = req.minPx; size <= req.maxPx; size += 0.5) outcomes.push(fitsAt(req, measure, size))

    // Once it stops fitting it must never start again, or a binary search could
    // walk straight past the answer.
    const firstFailure = outcomes.indexOf(false)
    const afterFirstFailure = firstFailure === -1 ? [] : outcomes.slice(firstFailure)

    expect(afterFirstFailure.every((fits) => !fits)).toBe(true)
    expect(outcomes[0]).toBe(true)
  })
})
