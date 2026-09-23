import { shallowRef } from 'vue'

import {
  FIT_SAFETY_PX,
  type FitBox,
  type FitRequest,
  type FitResult,
  fitText,
  linesOf,
  type Measurement,
  type TextMeasurer
} from '@/lib/fit-text'
import { computePriceView } from '@/lib/price'
import type { Label } from '@/lib/types'
import {
  BREAKDOWN_LINE_HEIGHT,
  BREAKDOWN_MAX_LINES,
  DEFAULT_LABEL_STYLE,
  fontRanges,
  labelBoxes,
  labelContent,
  type LabelFit,
  type LabelStyle,
  type StyleKey
} from '@/print/geometry'

/**
 * Font sizes for every label that is about to be printed.
 *
 * Measuring happens whenever the rendered set changes, not when the print button
 * is pressed: `beforeprint` cannot await anything, so the only safe design is one
 * where the DOM is already correct by the time anyone reaches for Cmd+P.
 */

export type { LabelFit } from '@/print/geometry'

/**
 * Widest string in a list, as a stand-in for actual width.
 *
 * Exact enough to pick a size for the amounts, which use tabular figures; the
 * column is then measured for real.
 */
function longest(values: readonly string[]): string {
  return values.reduce((winner, value) => (value.length > winner.length ? value : winner), '')
}

const DESCRIPTION_LINES = { max: BREAKDOWN_MAX_LINES, lineHeight: BREAKDOWN_LINE_HEIGHT } as const

export function createAutoFit(measure: TextMeasurer) {
  const cache = new Map<string, FitResult>()
  const measurements = new Map<string, Measurement>()
  const fits = shallowRef<ReadonlyMap<string, LabelFit>>(new Map())
  /** Labels whose text did not fit even at the smallest size. */
  const overflowing = shallowRef<ReadonlySet<string>>(new Set())

  // The size range belongs in the key as well as the box: changing a slider
  // changes the answer even when the box happens to stay the same.
  const cacheKey = (request: FitRequest): string =>
    `${request.styleKey}|${request.box.width}x${request.box.height}|${request.minPx}-${request.maxPx}|` +
    `${request.lines?.max ?? ''}|${request.text}`

  function fitCached(request: FitRequest): FitResult {
    const key = cacheKey(request)
    let result = cache.get(key)
    if (!result) {
      result = fitText(request, measure)
      cache.set(key, result)
    }
    return result
  }

  function measureCached(styleKey: StyleKey, text: string, fontSizePx: number, maxWidthPx?: number): Measurement {
    const wrap = maxWidthPx === undefined ? 'nowrap' : 'wrap'
    const key = `${styleKey}|${fontSizePx}|${maxWidthPx ?? ''}|${text}`
    let result = measurements.get(key)
    if (!result) {
      result = measure({ text, fontSizePx, maxWidthPx: maxWidthPx ?? Number.POSITIVE_INFINITY, wrap, styleKey })
      measurements.set(key, result)
    }
    return result
  }

  /**
   * Measure one label, in the order its parts depend on each other.
   *
   * Everything with a box of its own comes first. Then the add-on columns, which
   * are as wide as their widest entry, so the descriptions know how much width
   * they have; the descriptions may take two lines and share one size, so the
   * longest of them cannot hold the others small. Last the price, which gets
   * whatever height is left -- including what a shrunk text gave back.
   */
  function measureLabel(label: Label, brand: string | null, style: LabelStyle): { fit: LabelFit; overflows: boolean } {
    const view = computePriceView(label)
    const ranges = fontRanges(style)
    const sizes: Partial<Record<StyleKey, number>> = {}
    let overflows = false

    const fitInto = (
      styleKey: StyleKey,
      text: string,
      box: FitBox,
      wrap: 'wrap' | 'nowrap',
      lines?: FitRequest['lines']
    ): number => {
      const result = fitCached({ text, box, styleKey, wrap, lines, ...ranges[styleKey] })
      if (result.status === 'overflow') overflows = true
      return result.fontSizePx
    }

    const boxes = labelBoxes(labelContent(label, view, brand), style)
    const single = (styleKey: StyleKey, text: string | null): void => {
      if (text) sizes[styleKey] = fitInto(styleKey, text, boxes[styleKey], 'nowrap')
    }

    // The name wraps into its box; every other text in the head and foot is a
    // single line by design, so the label keeps the same shape across the shop.
    if (label.name) sizes.name = fitInto('name', label.name, boxes.name, 'wrap')
    single('subtitle', label.subtitle)
    single('artNr', label.artNr === null ? null : `Art. ${label.artNr}`)
    single('priceSuffix', view.suffix)
    single('note', label.note)
    single('brand', brand)

    let fit: LabelFit = { sizes }
    const rows = view.breakdown
    if (rows.length > 0) {
      const widest = (styleKey: StyleKey, texts: readonly string[]): number | undefined => {
        const size = sizes[styleKey]
        if (size === undefined) return undefined
        return Math.max(...texts.map((text) => measureCached(styleKey, text, size).width))
      }

      const amounts = rows.map((row) => row.amountText)
      sizes.breakdownAmount = fitInto('breakdownAmount', longest(amounts), boxes.breakdownAmount, 'nowrap')

      const artNrs = rows.flatMap((row) => (row.artNr ? [`Art. ${row.artNr}`] : []))
      if (artNrs.length > 0) {
        sizes.breakdownArtNr = fitInto('breakdownArtNr', longest(artNrs), boxes.breakdownArtNr, 'nowrap')
      }

      fit = { sizes, amountWidthPx: widest('breakdownAmount', amounts), artNrWidthPx: widest('breakdownArtNr', artNrs) }

      const description = labelBoxes(labelContent(label, view, brand, fit), style).breakdownLabel
      const labelled = rows.map((row) => row.label).filter((text) => text.length > 0)
      if (labelled.length > 0) {
        sizes.breakdownLabel = Math.min(
          ...labelled.map((text) => fitInto('breakdownLabel', text, description, 'wrap', DESCRIPTION_LINES))
        )
      }

      const size = sizes.breakdownLabel
      // Line breaking uses the same usable width the search measured against.
      const usableWidth = description.width - FIT_SAFETY_PX
      fit = {
        ...fit,
        breakdownLines: rows.map((row) =>
          size === undefined || row.label.length === 0
            ? 1
            : linesOf(measureCached('breakdownLabel', row.label, size, usableWidth).height, size, BREAKDOWN_LINE_HEIGHT)
        )
      }
    }

    const priceBox = labelBoxes(labelContent(label, view, brand, fit), style).price
    sizes.price = fitInto('price', view.mainText, priceBox, 'nowrap')

    return { fit, overflows }
  }

  /**
   * Measure everything that is about to be shown, then publish in one go.
   *
   * Collecting first and assigning once means a single Vue render, rather than
   * one per label interleaved with layout reads.
   */
  function ensureMeasured(
    labels: readonly Label[],
    brand: string | null,
    style: LabelStyle = DEFAULT_LABEL_STYLE
  ): void {
    const nextFits = new Map<string, LabelFit>()
    const nextOverflowing = new Set<string>()

    for (const label of labels) {
      const { fit, overflows } = measureLabel(label, brand, style)
      if (overflows) nextOverflowing.add(label.id)
      nextFits.set(label.id, fit)
    }

    fits.value = nextFits
    overflowing.value = nextOverflowing
  }

  /**
   * Throw away measurements taken with fallback font metrics.
   *
   * Until the embedded face has loaded, every measurement is wrong -- the
   * fallback has different widths, so a name that "fits" would overflow once the
   * real font arrives.
   */
  function invalidate(): void {
    cache.clear()
    measurements.clear()
  }

  return {
    fits,
    overflowing,
    fitFor: (labelId: string): LabelFit | undefined => fits.value.get(labelId),
    ensureMeasured,
    invalidate,
    cacheSize: () => cache.size + measurements.size
  }
}

export type AutoFitStore = ReturnType<typeof createAutoFit>
