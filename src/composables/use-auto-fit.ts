import { shallowRef } from 'vue'

import { type FitRequest, type FitResult, fitText, type TextMeasurer } from '@/lib/fit-text'
import { computePriceView } from '@/lib/price'
import type { Label } from '@/lib/types'
import {
  DEFAULT_LABEL_STYLE,
  fontRanges,
  labelBoxes,
  labelContent,
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

export type LabelFit = Partial<Record<StyleKey, number>>

interface KeyedRequest {
  readonly styleKey: StyleKey
  readonly request: FitRequest
}

/**
 * Widest string in a list, as a stand-in for actual width.
 *
 * Exact for the amount column, which uses tabular figures, and close enough for
 * the descriptions -- where the label falls back to an ellipsis anyway.
 */
function longest(values: readonly string[]): string {
  return values.reduce((winner, value) => (value.length > winner.length ? value : winner), '')
}

/**
 * What to measure for one label.
 *
 * Without `fitted`, every box has the height of its text at full size. With it,
 * the texts that had to shrink have given back what they no longer need, and
 * the price block has grown by as much.
 */
function requestsFor(label: Label, brand: string | null, style: LabelStyle, fitted?: LabelFit): KeyedRequest[] {
  const view = computePriceView(label)
  const boxes = labelBoxes(labelContent(label, view, brand, fitted), style)
  const ranges = fontRanges(style)
  const requests: KeyedRequest[] = []

  const add = (styleKey: StyleKey, text: string, wrap: 'wrap' | 'nowrap'): void => {
    if (text.length === 0) return
    requests.push({
      styleKey,
      request: { text, box: boxes[styleKey], styleKey, wrap, ...ranges[styleKey] }
    })
  }

  // Only the name gets more than one line; every other box is a single line by
  // design, so the label keeps the same shape across the whole shop.
  add('name', label.name, 'wrap')
  add('subtitle', label.subtitle ?? '', 'nowrap')
  add('artNr', label.artNr === null ? '' : `Art. ${label.artNr}`, 'nowrap')
  add('price', view.mainText, 'nowrap')
  add('priceSuffix', view.suffix ?? '', 'nowrap')
  add('note', label.note ?? '', 'nowrap')
  add('brand', brand ?? '', 'nowrap')

  if (view.breakdown.length > 0) {
    add('breakdownLabel', longest(view.breakdown.map((row) => row.label)), 'nowrap')
    add('breakdownAmount', longest(view.breakdown.map((row) => row.amountText)), 'nowrap')
  }

  return requests
}

export function createAutoFit(measure: TextMeasurer) {
  const cache = new Map<string, FitResult>()
  const fits = shallowRef<ReadonlyMap<string, LabelFit>>(new Map())
  /** Labels whose text did not fit even at the smallest size. */
  const overflowing = shallowRef<ReadonlySet<string>>(new Set())

  // The size range belongs in the key as well as the box: changing a slider
  // changes the answer even when the box happens to stay the same.
  const cacheKey = ({ styleKey, request }: KeyedRequest): string =>
    `${styleKey}|${request.box.width}x${request.box.height}|${request.minPx}-${request.maxPx}|${request.text}`

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
      const fit: LabelFit = {}
      const overflowing = new Set<StyleKey>()

      const run = (requests: readonly KeyedRequest[]): void => {
        for (const keyed of requests) {
          const key = cacheKey(keyed)
          let result = cache.get(key)
          if (!result) {
            result = fitText(keyed.request, measure)
            cache.set(key, result)
          }
          fit[keyed.styleKey] = result.fontSizePx
          if (result.status === 'overflow') overflowing.add(keyed.styleKey)
          else overflowing.delete(keyed.styleKey)
        }
      }

      run(requestsFor(label, brand, style))
      // Now that the single-line texts know their real size, they claim only the
      // height they need. The price takes whatever is left, so it is fitted
      // again, into the room it actually gets -- which is never less than before.
      run(requestsFor(label, brand, style, { ...fit }).filter(({ styleKey }) => styleKey === 'price'))

      if (overflowing.size > 0) nextOverflowing.add(label.id)
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
  }

  return {
    fits,
    overflowing,
    fitFor: (labelId: string): LabelFit | undefined => fits.value.get(labelId),
    ensureMeasured,
    invalidate,
    cacheSize: () => cache.size
  }
}

export type AutoFitStore = ReturnType<typeof createAutoFit>
