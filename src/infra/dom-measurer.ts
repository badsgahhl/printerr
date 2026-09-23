import type { MeasureInput, Measurement, TextMeasurer } from '@/lib/fit-text'
import type { StyleKey } from '@/print/geometry'

/**
 * Real text measurement, in a sandbox of its own.
 *
 * Measuring inside the visible label would mean reading layout back out of the
 * preview: `getBoundingClientRect` returns transformed values, so the preview's
 * scale would corrupt every number, and interleaving reads with writes there
 * would thrash layout. A detached element under `contain: strict` has neither
 * problem -- the forced reflow is confined to one node.
 */

/** The label class whose typography each style key should be measured with. */
const CLASS_FOR_STYLE: Readonly<Record<StyleKey, string>> = {
  name: 'label__name',
  subtitle: 'label__subtitle',
  artNr: 'label__artnr',
  price: 'label__price-main',
  priceSuffix: 'label__price-suffix',
  breakdownLabel: 'label__row-label',
  breakdownArtNr: 'label__row-artnr',
  breakdownAmount: 'label__row-amount',
  note: 'label__note',
  brand: 'label__brand'
}

export interface DomMeasurer {
  readonly measure: TextMeasurer
  dispose(): void
}

export function createDomMeasurer(doc: Document = document): DomMeasurer {
  const host = doc.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.dataset.printerrMeasure = ''
  Object.assign(host.style, {
    position: 'fixed',
    top: '0',
    left: '-10000px',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    // Confines the forced reflow of each measurement to this subtree.
    contain: 'strict',
    // Not display:none -- a hidden element has no dimensions to read.
    visibility: 'hidden'
  })

  // The cell sits inside a .label so it inherits the font stack and custom
  // properties the real label uses.
  const frame = doc.createElement('div')
  frame.className = 'label'
  Object.assign(frame.style, {
    display: 'block',
    width: 'auto',
    height: 'auto',
    padding: '0',
    overflow: 'visible'
  })

  const cell = doc.createElement('div')
  frame.append(cell)
  host.append(frame)
  doc.body.append(host)

  const measure: TextMeasurer = (input: MeasureInput): Measurement => {
    cell.className = CLASS_FOR_STYLE[input.styleKey as StyleKey] ?? ''
    cell.textContent = input.text

    // The label classes fix height and use flex; measuring needs neither.
    cell.style.cssText = ''
    cell.style.display = 'block'
    cell.style.height = 'auto'
    cell.style.overflow = 'visible'
    cell.style.textOverflow = 'clip'
    // A clamped description would report two lines however many it needs:
    // Chrome applies the clamp to plain blocks too, not only to -webkit-box.
    cell.style.setProperty('-webkit-line-clamp', 'none')
    cell.style.setProperty('line-clamp', 'none')
    cell.style.fontSize = `${input.fontSizePx}px`

    if (input.wrap === 'nowrap') {
      cell.style.whiteSpace = 'nowrap'
      cell.style.width = 'max-content'
    } else {
      cell.style.whiteSpace = 'normal'
      cell.style.width = `${input.maxWidthPx}px`
    }

    const rect = cell.getBoundingClientRect()

    return {
      // For wrapped text the box is as wide as it was told to be; what matters
      // is whether the content needed more than that.
      width: input.wrap === 'nowrap' ? rect.width : Math.min(rect.width, cell.scrollWidth),
      height: rect.height,
      // A single word wider than the box cannot be rescued by wrapping.
      overflowsWidth: input.wrap === 'wrap' && cell.scrollWidth > cell.clientWidth + 1
    }
  }

  return {
    measure,
    dispose: () => host.remove()
  }
}
