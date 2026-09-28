import { render } from 'vitest-browser-vue'
import { commands, page } from 'vitest/browser'
import { defineComponent, h } from 'vue'

import { createAutoFit } from '@/composables/use-auto-fit'
import { createDomMeasurer } from '@/infra/dom-measurer'
import { paginate } from '@/lib/paginate'
import type { PriceFormat } from '@/lib/price'
import type { Label } from '@/lib/types'
import { DEFAULT_LABEL_STYLE, type LabelFit, type LabelStyle, slotsPerSheet } from '@/print/geometry'
import PriceLabel from '@/print/PriceLabel.vue'
import PrintSheet from '@/print/PrintSheet.vue'

/**
 * Rendering a label the way the app does, in a browser that can measure.
 *
 * The point of the browser suite: jsdom answers every measurement with zero, so
 * the fitted sizes -- the whole reason this app exists -- can only be seen here.
 * These helpers therefore run the real measuring sandbox and the real auto-fit
 * rather than handing the components a made-up `fit`.
 */

/**
 * Everything is mounted inside `#app`, as the app itself is.
 *
 * Not cosmetic: in print, `print.css` hides every child of `<body>` that is not
 * the app, so that a dialog teleported next to it cannot print a page of its
 * own. A test rendering into a bare `<div>` would photograph a hidden element.
 */
function appContainer(): HTMLElement {
  const existing = document.querySelector<HTMLElement>('#app')
  if (existing) {
    existing.replaceChildren()
    return existing
  }
  const container = document.createElement('div')
  container.id = 'app'
  document.body.append(container)
  return container
}

export interface RenderOptions {
  readonly style?: LabelStyle
  readonly brand?: string | null
  readonly priceFormat?: PriceFormat
  readonly showRuler?: boolean
  readonly blocked?: readonly number[]
}

/**
 * Wait until the embedded face is really there.
 *
 * `document.fonts.ready` alone resolves while nothing is loading, which is also
 * true before anything asked for the label face; the first measurement would
 * then be taken with the fallback's widths.
 */
export async function labelFontReady(): Promise<void> {
  await Promise.all([400, 600, 700].map((weight) => document.fonts.load(`${weight} 16px "Source Serif 4"`)))
  await document.fonts.ready
}

/** The fitted sizes for a set of labels, measured for real. */
export async function fitsFor(
  labels: readonly Label[],
  options: RenderOptions = {}
): Promise<ReadonlyMap<string, LabelFit>> {
  await labelFontReady()
  const measurer = createDomMeasurer()
  try {
    const autoFit = createAutoFit(measurer.measure, () => measurer.usable())
    autoFit.ensureMeasured(labels, options.brand ?? null, options.style ?? DEFAULT_LABEL_STYLE, options.priceFormat)
    return new Map(labels.map((label) => [label.id, autoFit.fitFor(label.id)!]))
  } finally {
    measurer.dispose()
  }
}

/** One label, fitted and rendered; the locator is the label itself. */
export async function renderLabel(label: Label, options: RenderOptions = {}) {
  const fits = await fitsFor([label], options)
  const screen = await render(PriceLabel, {
    container: appContainer(),
    props: {
      label,
      fit: fits.get(label.id),
      brand: options.brand ?? null,
      labelStyle: options.style ?? DEFAULT_LABEL_STYLE,
      priceFormat: options.priceFormat
    }
  })
  return { screen, fit: fits.get(label.id)!, locator: page.elementLocator(screen.container.querySelector('.label')!) }
}

/** A whole sheet, filled from the front with the labels given. */
export async function renderSheet(labels: readonly Label[], options: RenderOptions = {}) {
  const style = options.style ?? DEFAULT_LABEL_STYLE
  const fits = await fitsFor(labels, { ...options, style })
  const [sheet] = paginate(
    labels.map((label) => ({ labelId: label.id, copies: label.copies })),
    { slotsPerSheet: slotsPerSheet(style), blockedFirstSheetSlots: options.blocked ?? [] }
  )

  const view = defineComponent({
    setup: () => () =>
      h(
        PrintSheet,
        { sheet: sheet!, labelStyle: style, showRuler: options.showRuler === true },
        {
          label: ({ labelId }: { labelId: string }) => {
            const label = labels.find((candidate) => candidate.id === labelId)
            return label
              ? h(PriceLabel, {
                  label,
                  fit: fits.get(label.id),
                  brand: options.brand ?? null,
                  labelStyle: style,
                  priceFormat: options.priceFormat
                })
              : null
          }
        }
      )
  })

  const screen = await render(view, { container: appContainer() })
  return { screen, locator: page.elementLocator(screen.container.querySelector('.sheet')!) }
}

/**
 * Look at the page as the printer will.
 *
 * Print is not a detail of the stylesheet here, it is the product: the cut
 * marks are a quarter millimetre rather than a screen pixel, the preview's
 * shadow is gone, and the measuring sandbox is hidden -- which is exactly the
 * state in which a careless re-measure once blew every text up to its maximum.
 */
export async function printMedia(): Promise<void> {
  await commands.emulateMedia('print')
}

export async function screenMedia(): Promise<void> {
  await commands.emulateMedia('screen')
}

/** The fitted sizes as a snapshot reads best: whole numbers of px, sorted. */
export function fittedSizes(fit: LabelFit): Record<string, number> {
  return Object.fromEntries(
    Object.entries(fit.sizes)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, size]) => [key, Math.round((size ?? 0) * 100) / 100])
  )
}
