import type { Label, LabelExtra } from '@/lib/types'

/**
 * Price arithmetic and formatting.
 *
 * Money is integer cents everywhere. The only float in this file is the divide
 * by 100 handed to Intl, where rounding to two decimals makes it exact again.
 */

// Building an Intl formatter is expensive, so it happens once.
const EURO = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

/** How prices are written, where the shop has a say in it. */
export interface PriceFormat {
  /**
   * Writes a price with no cents the way a shop window writes it: 139,– € for
   * 139,00 €. Three characters shorter, which on a small label is the
   * difference between a price that fills the width and one that can be set
   * larger. Off unless the shop asks for it.
   */
  readonly shortenWholePrices?: boolean
}

/**
 * The dash that stands in for two zero cents.
 *
 * Built from the same formatter rather than by string surgery, so the grouping
 * dot and the narrow space before the euro sign stay exactly as Intl writes
 * them -- only the two zeros are replaced.
 */
function wholeEuroText(cents: number): string {
  return EURO.formatToParts(cents / 100)
    .map((part) => (part.type === 'fraction' ? '–' : part.value))
    .join('')
}

export function formatCents(cents: number, format: PriceFormat = {}): string {
  if (format.shortenWholePrices === true && cents % 100 === 0) return wholeEuroText(cents)
  return EURO.format(cents / 100)
}

export function sumCents(values: Iterable<number>): number {
  let total = 0
  for (const value of values) total += value
  return total
}

export interface PriceBreakdownRow {
  readonly label: string
  readonly artNr: string | null
  /** Already formatted -- either a real amount or the seller's free text. */
  readonly amountText: string
  readonly exhibited: boolean
}

export interface PriceView {
  /** 'exhibition' as soon as anything is marked as standing with the piece. */
  readonly mode: 'base' | 'exhibition'
  readonly mainCents: number
  readonly mainText: string
  /** Printed small under the big price. */
  readonly suffix: string | null
  readonly breakdown: readonly PriceBreakdownRow[]
}

/** Add-ons on display that carry no number, so no total can be formed from them. */
export function exhibitedWithoutPrice(label: Label): readonly LabelExtra[] {
  return label.extras.filter((extra) => extra.exhibited && extra.priceCents === null)
}

function amountText(extra: LabelExtra, format: PriceFormat): string {
  if (extra.priceCents !== null) return formatCents(extra.priceCents, format)
  return extra.priceText ?? ''
}

/**
 * Work out what the label actually prints.
 *
 * The rule the whole app hangs on: if anything is marked as exhibited, the big
 * number is the price of the piece as the customer sees it standing there, and
 * the base price moves down into the breakdown. That is what the PAngV asks for
 * -- the displayed item carries its own final price.
 *
 * An exhibited add-on without a number cannot be added up. It still shows in the
 * breakdown, and `exhibitedWithoutPrice` lets the importer raise a diagnostic,
 * but the total silently skipping it would be worse than a total that is visibly
 * flagged as incomplete.
 */
export function computePriceView(label: Label, format: PriceFormat = {}): PriceView {
  const isExhibition = label.extras.some((extra) => extra.exhibited)

  if (!isExhibition) {
    return {
      mode: 'base',
      mainCents: label.priceCents,
      mainText: formatCents(label.priceCents, format),
      suffix: label.priceNote,
      breakdown: label.extras.map((extra) => ({
        label: extra.name,
        artNr: extra.artNr,
        amountText: amountText(extra, format),
        exhibited: false
      }))
    }
  }

  const exhibitedCents = sumCents(label.extras.filter((extra) => extra.exhibited).map((extra) => extra.priceCents ?? 0))
  const mainCents = label.priceCents + exhibitedCents

  return {
    mode: 'exhibition',
    mainCents,
    mainText: formatCents(mainCents, format),
    suffix: 'wie ausgestellt',
    breakdown: [
      // The base price leads the breakdown; the seller's qualifier ("ohne
      // Figuren") names it better than the word "Grundpreis" ever could.
      {
        label: label.priceNote ?? 'Grundpreis',
        artNr: null,
        amountText: formatCents(label.priceCents, format),
        exhibited: false
      },
      ...label.extras.map((extra) => ({
        label: extra.name,
        artNr: extra.artNr,
        amountText: amountText(extra, format),
        exhibited: extra.exhibited
      }))
    ]
  }
}
