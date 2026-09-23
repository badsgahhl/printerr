/**
 * Choosing a font size that makes a piece of text fit its box.
 *
 * Pure search logic: the measuring itself is injected, because a real
 * measurement needs a browser and jsdom reports every dimension as zero. The
 * DOM side lives in infra/dom-measurer.ts.
 */

export interface FitBox {
  readonly width: number
  readonly height: number
}

export interface MeasureInput {
  readonly text: string
  readonly fontSizePx: number
  /** Ignored when wrap is 'nowrap'. */
  readonly maxWidthPx: number
  readonly wrap: 'nowrap' | 'wrap'
  /** Names the CSS class the measurement should use, e.g. 'name' or 'price'. */
  readonly styleKey: string
}

export interface Measurement {
  readonly width: number
  readonly height: number
  /** A single unbreakable word is wider than the box, so wrapping cannot save it. */
  readonly overflowsWidth: boolean
}

export type TextMeasurer = (input: MeasureInput) => Measurement

export interface FitRequest {
  readonly text: string
  readonly box: FitBox
  readonly styleKey: string
  readonly wrap: 'nowrap' | 'wrap'
  readonly minPx: number
  readonly maxPx: number
  /** Quantises the result; 0.5px is fine enough that nobody sees the step. */
  readonly stepPx?: number
  /** Kept clear inside the box, to absorb sub-pixel rounding. */
  readonly safetyPx?: number
  /**
   * For wrapped text: how many lines it may take, in place of the box height.
   * The line height is the one the stylesheet gives the text, in em.
   */
  readonly lines?: { readonly max: number; readonly lineHeight: number }
}

export type FitStatus = 'fits' | 'shrunk' | 'overflow'

export interface FitResult {
  readonly fontSizePx: number
  readonly status: FitStatus
  readonly measuredHeight: number
  readonly measuredWidth: number
  /** Exposed so a test can hold the search to its budget. */
  readonly measureCalls: number
}

const DEFAULT_STEP = 0.5
/** Kept clear inside every box unless a request says otherwise. */
export const FIT_SAFETY_PX = 0.5
/** Sub-pixel slack, so a measurement landing exactly on the edge counts as fitting. */
const EPSILON = 0.01

const round = (value: number): number => Math.round(value * 1000) / 1000

/**
 * The number of measurements `fitText` may take for a given request.
 *
 * Tests assert against this rather than a hard-coded number, so tightening the
 * search cannot quietly regress into a linear scan.
 */
export function measureBudget(request: FitRequest): number {
  const step = request.stepPx ?? DEFAULT_STEP
  const steps = Math.max(1, Math.ceil((request.maxPx - request.minPx) / step))
  return Math.ceil(Math.log2(steps + 1)) + 2
}

export function fitText(request: FitRequest, measure: TextMeasurer): FitResult {
  const step = request.stepPx ?? DEFAULT_STEP
  const safety = request.safetyPx ?? FIT_SAFETY_PX
  const { minPx, maxPx, box, wrap, styleKey, text } = request

  const usableWidth = box.width - safety
  const usableHeight = box.height - safety

  let calls = 0

  const sizeAt = (index: number): number => round(Math.min(maxPx, minPx + index * step))

  const attempt = (fontSizePx: number): { fits: boolean; height: number; width: number } => {
    calls += 1
    const measurement = measure({
      text,
      fontSizePx,
      // Wrapped text breaks at the usable width, not the full box width, so the
      // safety margin is respected by the line breaking itself.
      maxWidthPx: wrap === 'wrap' ? usableWidth : Number.POSITIVE_INFINITY,
      wrap,
      styleKey
    })
    const withinHeight = request.lines
      ? linesOf(measurement.height, fontSizePx, request.lines.lineHeight) <= request.lines.max
      : measurement.height <= usableHeight + EPSILON
    const fits = !measurement.overflowsWidth && measurement.width <= usableWidth + EPSILON && withinHeight
    return { fits, height: measurement.height, width: measurement.width }
  }

  // The common case by far: short names and small prices fit at full size.
  const atMax = attempt(maxPx)
  if (atMax.fits) {
    return {
      fontSizePx: round(maxPx),
      status: 'fits',
      measuredHeight: atMax.height,
      measuredWidth: atMax.width,
      measureCalls: calls
    }
  }

  if (wrap === 'nowrap') {
    // Width scales linearly with font size, so the measurement just taken
    // already says how far to shrink. The verification below absorbs hinting
    // and rounding.
    const naturalWidth = measure({
      text,
      fontSizePx: maxPx,
      maxWidthPx: Number.POSITIVE_INFINITY,
      wrap,
      styleKey
    }).width
    calls += 1

    if (naturalWidth > 0) {
      const scaled = (maxPx * usableWidth) / naturalWidth
      let index = Math.max(0, Math.floor((Math.min(scaled, maxPx) - minPx) / step))
      let candidate = attempt(sizeAt(index))

      // One step down is enough; the estimate is never off by more than that.
      if (!candidate.fits && index > 0) {
        index -= 1
        candidate = attempt(sizeAt(index))
      }

      if (candidate.fits) {
        const chosen = sizeAt(index)
        return {
          fontSizePx: chosen,
          status: chosen >= maxPx ? 'fits' : 'shrunk',
          measuredHeight: candidate.height,
          measuredWidth: candidate.width,
          measureCalls: calls
        }
      }
    }

    return {
      fontSizePx: round(minPx),
      status: 'overflow',
      measuredHeight: atMax.height,
      measuredWidth: atMax.width,
      measureCalls: calls
    }
  }

  // Wrapped text: shrinking changes where lines break, so height is not linear
  // in font size -- but it is monotonic, which is all a binary search needs.
  // Monotonicity holds only without `hyphens: auto` and without
  // `text-wrap: pretty`; both are forbidden in label.css for exactly this reason.
  const lastIndex = Math.max(1, Math.ceil((maxPx - minPx) / step))
  let low = 0
  let high = lastIndex - 1
  let best = -1
  let bestHeight = 0
  let bestWidth = 0

  while (low <= high) {
    const mid = (low + high) >> 1
    const candidate = attempt(sizeAt(mid))
    if (candidate.fits) {
      best = mid
      bestHeight = candidate.height
      bestWidth = candidate.width
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  if (best === -1) {
    return {
      fontSizePx: round(minPx),
      status: 'overflow',
      measuredHeight: bestHeight,
      measuredWidth: bestWidth,
      measureCalls: calls
    }
  }

  return {
    fontSizePx: sizeAt(best),
    status: 'shrunk',
    measuredHeight: bestHeight,
    measuredWidth: bestWidth,
    measureCalls: calls
  }
}

/**
 * How many lines a measured height amounts to.
 *
 * Rounded rather than truncated: line boxes land on fractional pixels, so two
 * lines can measure a hair over or under twice one.
 */
export function linesOf(heightPx: number, fontSizePx: number, lineHeight: number): number {
  return Math.max(1, Math.round(heightPx / (fontSizePx * lineHeight)))
}
