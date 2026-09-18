import type { FitBox } from '@/lib/fit-text'

/**
 * Every millimetre the label is made of.
 *
 * This is the single source of truth: PriceLabel binds these as CSS custom
 * properties, and the auto-fit code derives its boxes from the same numbers. If
 * the geometry lived in the stylesheet, the measuring code would have to read it
 * back out of the layout -- which is exactly the dependency that makes auto-fit
 * fragile.
 */

/** CSS reference pixels per millimetre: 96dpi over 25.4mm to the inch. */
export const MM_TO_PX = 96 / 25.4

export const mmToPx = (mm: number): number => mm * MM_TO_PX
export const pxToMm = (px: number): number => px / MM_TO_PX

export const SHEET_WIDTH_MM = 210
export const SHEET_HEIGHT_MM = 297

/**
 * A quarter of A4, not ISO A6.
 *
 * A6 proper is 105 x 148mm, which leaves a millimetre of waste per sheet and
 * drifts the cut lines. 148.5 divides A4 exactly.
 */
export const LABEL_WIDTH_MM = 105
export const LABEL_HEIGHT_MM = 148.5

export const COLUMNS = 2
export const ROWS = 2

/**
 * The three sizes a shop can actually want to change, plus the margin.
 *
 * Each size is an *upper bound*, not a fixed size: the fitting pass still shrinks
 * text that would not fit. Setting the price to its maximum makes short prices
 * large without letting "1.148,00 EUR" run off the card.
 */
export interface LabelStyle {
  readonly paddingMm: number
  readonly nameMaxPx: number
  readonly priceMaxPx: number
  /** Subtitle, article number, breakdown rows, note and shop name. */
  readonly detailMaxPx: number
}

export const DEFAULT_LABEL_STYLE: LabelStyle = {
  /**
   * Consumer printers physically cannot reach the outer 3-6mm of a sheet
   * whatever `@page { margin: 0 }` says, and the outer edge of a label is the
   * edge of the paper. Nine millimetres clears that with room to spare.
   */
  paddingMm: 9,
  nameMaxPx: 34,
  priceMaxPx: 72,
  detailMaxPx: 12
}

/** What the settings sliders may offer. Below the minimum nothing is readable. */
export const STYLE_LIMITS = {
  paddingMm: { min: 5, max: 16, step: 0.5 },
  nameMaxPx: { min: 16, max: 52, step: 1 },
  priceMaxPx: { min: 30, max: 110, step: 1 },
  detailMaxPx: { min: 8, max: 20, step: 0.5 }
} as const

// Proportions calibrated against DEFAULT_LABEL_STYLE; the sliders scale these
// rather than replacing them, so the label keeps its balance at every setting.
const BASE_NAME_MM = 20
const BASE_SUBTITLE_MM = 6
const BASE_ART_NR_MM = 5
const BASE_NOTE_MM = 5
const BASE_BRAND_MM = 6
const BASE_BREAKDOWN_ROW_MM = 5.2

const HEAD_GAP_MM = 1.5
const FOOT_GAP_MM = 1.5
const BREAKDOWN_GAP_MM = 3
const PRICE_GAP_MM = 2

/** Width reserved for the amount column of a breakdown row. */
const AMOUNT_WIDTH_MM = 30
/**
 * Width reserved for the article number in a breakdown row.
 *
 * Claimed for every row as soon as one of them carries a number, so the columns
 * line up -- and, more importantly, so the description is measured against the
 * width it actually gets rather than the whole row.
 */
const ARTNR_COLUMN_MM = 17
const ROW_GAP_MM = 1.5

/** Never let the price block collapse, however the sliders are set. */
const MIN_PRICE_BLOCK_MM = 12

const nameScale = (style: LabelStyle): number => style.nameMaxPx / DEFAULT_LABEL_STYLE.nameMaxPx
const detailScale = (style: LabelStyle): number => style.detailMaxPx / DEFAULT_LABEL_STYLE.detailMaxPx

export const contentWidthMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number => LABEL_WIDTH_MM - 2 * style.paddingMm

export const contentHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number =>
  LABEL_HEIGHT_MM - 2 * style.paddingMm

export const nameHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number => BASE_NAME_MM * nameScale(style)

export const subtitleHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number =>
  BASE_SUBTITLE_MM * detailScale(style)

export const artNrHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number => BASE_ART_NR_MM * detailScale(style)

export const headHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number =>
  nameHeightMm(style) + subtitleHeightMm(style) + artNrHeightMm(style) + 2 * HEAD_GAP_MM

export const noteHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number => BASE_NOTE_MM * detailScale(style)

export const brandHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number => BASE_BRAND_MM * detailScale(style)

export const footHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number =>
  noteHeightMm(style) + brandHeightMm(style) + FOOT_GAP_MM

export const breakdownRowHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number =>
  BASE_BREAKDOWN_ROW_MM * detailScale(style)

/** Height of the small price qualifier under the big number. */
export const priceSuffixHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number =>
  BASE_SUBTITLE_MM * detailScale(style)

/** Width the article number column takes up, gap included. */
export function breakdownArtNrWidthMm(hasArtNr: boolean): number {
  return hasArtNr ? ARTNR_COLUMN_MM + ROW_GAP_MM : 0
}

/** How tall the breakdown block is for a given number of rows. */
export function breakdownHeightMm(rows: number, style: LabelStyle = DEFAULT_LABEL_STYLE): number {
  return rows <= 0 ? 0 : BREAKDOWN_GAP_MM + rows * breakdownRowHeightMm(style)
}

/** What is left for the price once head, foot and breakdown have taken their share. */
export function priceBlockHeightMm(rows: number, style: LabelStyle = DEFAULT_LABEL_STYLE): number {
  const remaining = contentHeightMm(style) - headHeightMm(style) - footHeightMm(style) - breakdownHeightMm(rows, style)
  return Math.max(MIN_PRICE_BLOCK_MM, remaining)
}

export interface LabelBoxes {
  readonly name: FitBox
  readonly subtitle: FitBox
  readonly artNr: FitBox
  readonly price: FitBox
  readonly priceSuffix: FitBox
  readonly breakdownLabel: FitBox
  readonly breakdownAmount: FitBox
  readonly note: FitBox
  readonly brand: FitBox
}

const box = (widthMm: number, heightMm: number): FitBox => ({
  width: mmToPx(widthMm),
  height: mmToPx(Math.max(0, heightMm))
})

/**
 * The measuring boxes for one label, in CSS pixels.
 *
 * A pure function of the row count, the article-number flag and the style, so it
 * can be tested without a browser and cannot disagree with the stylesheet.
 */
export function labelBoxes(
  breakdownRows: number,
  breakdownHasArtNr = false,
  style: LabelStyle = DEFAULT_LABEL_STYLE
): LabelBoxes {
  const width = contentWidthMm(style)
  const priceHeight = priceBlockHeightMm(breakdownRows, style)
  const suffixHeight = priceSuffixHeightMm(style)
  const labelWidth = width - AMOUNT_WIDTH_MM - breakdownArtNrWidthMm(breakdownHasArtNr) - ROW_GAP_MM

  return {
    name: box(width, nameHeightMm(style)),
    subtitle: box(width, subtitleHeightMm(style)),
    artNr: box(width, artNrHeightMm(style)),
    price: box(width, priceHeight - suffixHeight - PRICE_GAP_MM),
    priceSuffix: box(width, suffixHeight),
    breakdownLabel: box(Math.max(8, labelWidth), breakdownRowHeightMm(style)),
    breakdownAmount: box(AMOUNT_WIDTH_MM, breakdownRowHeightMm(style)),
    note: box(width, noteHeightMm(style)),
    brand: box(width, brandHeightMm(style))
  }
}

export type StyleKey =
  | 'name'
  | 'subtitle'
  | 'artNr'
  | 'price'
  | 'priceSuffix'
  | 'breakdownLabel'
  | 'breakdownAmount'
  | 'note'
  | 'brand'

export interface FontRange {
  readonly minPx: number
  readonly maxPx: number
}

/**
 * Font size range per style key.
 *
 * The maximum comes from the settings; the minimum is where text stops being
 * readable across a shop, clamped so it can never exceed the maximum.
 */
export function fontRanges(style: LabelStyle = DEFAULT_LABEL_STYLE): Readonly<Record<StyleKey, FontRange>> {
  const range = (minPx: number, maxPx: number): FontRange => ({
    minPx: Math.min(minPx, maxPx * 0.6),
    maxPx
  })

  return {
    name: range(11, style.nameMaxPx),
    subtitle: range(7, style.detailMaxPx * 1.25),
    artNr: range(7, style.detailMaxPx),
    price: range(22, style.priceMaxPx),
    priceSuffix: range(8, style.detailMaxPx * 1.3),
    breakdownLabel: range(6.5, style.detailMaxPx),
    breakdownAmount: range(6.5, style.detailMaxPx),
    note: range(6.5, style.detailMaxPx * 0.92),
    brand: range(7, style.detailMaxPx * 1.1)
  }
}

/** CSS custom property that carries the fitted font size for each style key. */
export const FONT_SIZE_VARS: Readonly<Record<StyleKey, string>> = {
  name: '--fs-name',
  subtitle: '--fs-subtitle',
  artNr: '--fs-artnr',
  price: '--fs-price',
  priceSuffix: '--fs-price-suffix',
  breakdownLabel: '--fs-breakdown-label',
  breakdownAmount: '--fs-breakdown-amount',
  note: '--fs-note',
  brand: '--fs-brand'
}

/** Custom properties handed to the label element, so CSS reuses these numbers. */
export function labelCssVars(
  breakdownRows: number,
  breakdownHasArtNr = false,
  style: LabelStyle = DEFAULT_LABEL_STYLE
): Record<string, string> {
  const mm = (value: number): string => `${Math.round(value * 1000) / 1000}mm`

  return {
    '--label-w': mm(LABEL_WIDTH_MM),
    '--label-h': mm(LABEL_HEIGHT_MM),
    '--label-pad': mm(style.paddingMm),
    '--label-head-h': mm(headHeightMm(style)),
    '--label-foot-h': mm(footHeightMm(style)),
    '--label-name-h': mm(nameHeightMm(style)),
    '--label-subtitle-h': mm(subtitleHeightMm(style)),
    '--label-artnr-h': mm(artNrHeightMm(style)),
    '--label-head-gap': mm(HEAD_GAP_MM),
    '--label-foot-gap': mm(FOOT_GAP_MM),
    '--label-price-h': mm(priceBlockHeightMm(breakdownRows, style)),
    '--label-price-suffix-h': mm(priceSuffixHeightMm(style)),
    '--label-price-gap': mm(PRICE_GAP_MM),
    '--label-breakdown-h': mm(breakdownHeightMm(breakdownRows, style)),
    '--label-breakdown-gap': mm(BREAKDOWN_GAP_MM),
    '--label-breakdown-row-h': mm(breakdownRowHeightMm(style)),
    '--label-amount-w': mm(AMOUNT_WIDTH_MM),
    '--label-artnr-col-w': mm(breakdownHasArtNr ? ARTNR_COLUMN_MM : 0),
    '--label-row-gap': mm(ROW_GAP_MM),
    '--label-note-h': mm(noteHeightMm(style)),
    '--label-brand-h': mm(brandHeightMm(style))
  }
}

/** Custom properties for one A4 sheet and its 2x2 grid. */
export function sheetCssVars(): Record<string, string> {
  return {
    '--sheet-w': `${SHEET_WIDTH_MM}mm`,
    '--sheet-h': `${SHEET_HEIGHT_MM}mm`,
    '--sheet-cols': String(COLUMNS),
    '--sheet-rows': String(ROWS),
    '--label-w': `${LABEL_WIDTH_MM}mm`,
    '--label-h': `${LABEL_HEIGHT_MM}mm`
  }
}
