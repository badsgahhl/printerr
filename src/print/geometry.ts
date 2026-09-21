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
 * The reference label: a quarter of A4, and what every proportion below is
 * calibrated against.
 *
 * Not ISO A6, which is 105 x 148mm: that leaves a millimetre of waste per sheet
 * and drifts the cut lines. 148.5 divides A4 exactly, as does every other grid.
 */
export const REFERENCE_COLUMNS = 2
export const REFERENCE_ROWS = 2
export const REFERENCE_WIDTH_MM = SHEET_WIDTH_MM / REFERENCE_COLUMNS
export const REFERENCE_HEIGHT_MM = SHEET_HEIGHT_MM / REFERENCE_ROWS

export interface SheetGrid {
  readonly columns: number
  readonly rows: number
}

/**
 * The three sizes a shop can want to change, the margin, and how the sheet is
 * divided.
 *
 * Each size is an *upper bound*, not a fixed size: the fitting pass still shrinks
 * text that would not fit. They are also stated for the reference label and
 * scaled to whatever grid is chosen, so switching from four labels a sheet to
 * nine keeps the design rather than leaving the type comically large.
 */
export interface LabelStyle {
  readonly columns: number
  readonly rows: number
  readonly paddingMm: number
  readonly nameMaxPx: number
  readonly priceMaxPx: number
  /** Subtitle, article number, breakdown rows, note and shop name. */
  readonly detailMaxPx: number
}

export const DEFAULT_LABEL_STYLE: LabelStyle = {
  columns: REFERENCE_COLUMNS,
  rows: REFERENCE_ROWS,
  /**
   * Consumer printers physically cannot reach the outer 3-6mm of a sheet
   * whatever `@page { margin: 0 }` says, and a label on the edge of the grid is
   * on the edge of the paper. Nine millimetres clears that with room to spare.
   */
  paddingMm: 9,
  nameMaxPx: 34,
  priceMaxPx: 72,
  detailMaxPx: 12
}

/** Grids that divide A4 without waste, in the order a shop would think of them. */
export const GRID_PRESETS: readonly { grid: SheetGrid; label: string; note: string }[] = [
  { grid: { columns: 1, rows: 1 }, label: '1 pro Bogen', note: 'A4' },
  { grid: { columns: 1, rows: 2 }, label: '2 pro Bogen', note: 'A5 quer' },
  { grid: { columns: 2, rows: 2 }, label: '4 pro Bogen', note: 'A6 hoch' },
  { grid: { columns: 2, rows: 3 }, label: '6 pro Bogen', note: '105 × 99 mm' },
  { grid: { columns: 2, rows: 4 }, label: '8 pro Bogen', note: 'A7 quer' },
  { grid: { columns: 3, rows: 3 }, label: '9 pro Bogen', note: '70 × 99 mm' },
  { grid: { columns: 3, rows: 4 }, label: '12 pro Bogen', note: '70 × 74 mm' },
  { grid: { columns: 4, rows: 4 }, label: '16 pro Bogen', note: 'A8 hoch' }
]

/**
 * What the settings may offer.
 *
 * The grid stops at 6 columns and rows: below roughly 35mm a label cannot carry
 * a readable price, let alone a name.
 */
export const STYLE_LIMITS = {
  columns: { min: 1, max: 6, step: 1 },
  rows: { min: 1, max: 6, step: 1 },
  paddingMm: { min: 2, max: 16, step: 0.5 },
  nameMaxPx: { min: 16, max: 52, step: 1 },
  priceMaxPx: { min: 30, max: 110, step: 1 },
  detailMaxPx: { min: 8, max: 20, step: 0.5 }
} as const

// Proportions calibrated against the reference label; the sliders and the grid
// scale these rather than replacing them, so a label keeps its balance at every
// setting.
const BASE_NAME_MM = 20
const BASE_SUBTITLE_MM = 6
const BASE_ART_NR_MM = 5
const BASE_NOTE_MM = 5
const BASE_BRAND_MM = 6
const BASE_BREAKDOWN_ROW_MM = 5.2

const BASE_HEAD_GAP_MM = 1.5
const BASE_FOOT_GAP_MM = 1.5
const BASE_BREAKDOWN_GAP_MM = 3
const BASE_PRICE_GAP_MM = 2

/** Width reserved for the amount column of a breakdown row. */
const BASE_AMOUNT_WIDTH_MM = 30
/**
 * Width reserved for the article number in a breakdown row.
 *
 * Claimed for every row as soon as one of them carries a number, so the columns
 * line up -- and, more importantly, so the description is measured against the
 * width it actually gets rather than the whole row.
 */
const BASE_ARTNR_COLUMN_MM = 17
const BASE_ROW_GAP_MM = 1.5

/** Never let the price block collapse, however the sliders are set. */
const MIN_PRICE_BLOCK_MM = 8

const clampGrid = (value: number, limit: { min: number; max: number }): number =>
  Math.min(limit.max, Math.max(limit.min, Math.trunc(value) || limit.min))

export const gridOf = (style: LabelStyle): SheetGrid => ({
  columns: clampGrid(style.columns, STYLE_LIMITS.columns),
  rows: clampGrid(style.rows, STYLE_LIMITS.rows)
})

export const slotsPerSheet = (style: LabelStyle): number => {
  const grid = gridOf(style)
  return grid.columns * grid.rows
}

export const labelWidthMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number => SHEET_WIDTH_MM / gridOf(style).columns

export const labelHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number => SHEET_HEIGHT_MM / gridOf(style).rows

/**
 * How the chosen label differs from the reference one.
 *
 * Horizontal measurements follow the width, vertical ones the height, and type
 * follows the smaller of the two -- a wide but short label has to shrink its
 * text as much as a narrow one, or it overflows vertically.
 */
const widthScale = (style: LabelStyle): number => labelWidthMm(style) / REFERENCE_WIDTH_MM
const heightScale = (style: LabelStyle): number => labelHeightMm(style) / REFERENCE_HEIGHT_MM
const typeScale = (style: LabelStyle): number => Math.min(widthScale(style), heightScale(style))

const nameScale = (style: LabelStyle): number => (style.nameMaxPx / DEFAULT_LABEL_STYLE.nameMaxPx) * heightScale(style)
const detailScale = (style: LabelStyle): number =>
  (style.detailMaxPx / DEFAULT_LABEL_STYLE.detailMaxPx) * heightScale(style)

/**
 * Below this a printer is likely to clip the labels on the edge of the sheet.
 *
 * Consumer printers cannot reach the outer 3-6mm of the paper, and the outer
 * labels of the grid sit right on it. The inner ones are unaffected, which is
 * why this is a warning rather than a floor.
 */
export const SAFE_PADDING_MM = 5

/** The margin shrinks with the label, but never below what a printer can reach. */
export const paddingMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number =>
  Math.max(STYLE_LIMITS.paddingMm.min, style.paddingMm * typeScale(style))

export const contentWidthMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number =>
  labelWidthMm(style) - 2 * paddingMm(style)

export const contentHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number =>
  labelHeightMm(style) - 2 * paddingMm(style)

export const nameHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number => BASE_NAME_MM * nameScale(style)

export const subtitleHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number =>
  BASE_SUBTITLE_MM * detailScale(style)

export const artNrHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number => BASE_ART_NR_MM * detailScale(style)

const headGapMm = (style: LabelStyle): number => BASE_HEAD_GAP_MM * heightScale(style)
const footGapMm = (style: LabelStyle): number => BASE_FOOT_GAP_MM * heightScale(style)
const breakdownGapMm = (style: LabelStyle): number => BASE_BREAKDOWN_GAP_MM * heightScale(style)
const priceGapMm = (style: LabelStyle): number => BASE_PRICE_GAP_MM * heightScale(style)

export const headHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number =>
  nameHeightMm(style) + subtitleHeightMm(style) + artNrHeightMm(style) + 2 * headGapMm(style)

export const noteHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number => BASE_NOTE_MM * detailScale(style)

export const brandHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number => BASE_BRAND_MM * detailScale(style)

export const footHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number =>
  noteHeightMm(style) + brandHeightMm(style) + footGapMm(style)

export const breakdownRowHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number =>
  BASE_BREAKDOWN_ROW_MM * detailScale(style)

/** Height of the small price qualifier under the big number. */
export const priceSuffixHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number =>
  BASE_SUBTITLE_MM * detailScale(style)

export const amountWidthMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number =>
  BASE_AMOUNT_WIDTH_MM * widthScale(style)

export const rowGapMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number => BASE_ROW_GAP_MM * widthScale(style)

/** Width the article number column takes up, gap included. */
export function breakdownArtNrWidthMm(hasArtNr: boolean, style: LabelStyle = DEFAULT_LABEL_STYLE): number {
  return hasArtNr ? BASE_ARTNR_COLUMN_MM * widthScale(style) + rowGapMm(style) : 0
}

/** How tall the breakdown block is for a given number of rows. */
export function breakdownHeightMm(rows: number, style: LabelStyle = DEFAULT_LABEL_STYLE): number {
  return rows <= 0 ? 0 : breakdownGapMm(style) + rows * breakdownRowHeightMm(style)
}

/** What is left for the price once head, foot and breakdown have taken their share. */
export function priceBlockHeightMm(rows: number, style: LabelStyle = DEFAULT_LABEL_STYLE): number {
  const remaining = contentHeightMm(style) - headHeightMm(style) - footHeightMm(style) - breakdownHeightMm(rows, style)
  return Math.max(MIN_PRICE_BLOCK_MM * heightScale(style), remaining)
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
  width: mmToPx(Math.max(0, widthMm)),
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
  const labelWidth = width - amountWidthMm(style) - breakdownArtNrWidthMm(breakdownHasArtNr, style) - rowGapMm(style)

  return {
    name: box(width, nameHeightMm(style)),
    subtitle: box(width, subtitleHeightMm(style)),
    artNr: box(width, artNrHeightMm(style)),
    price: box(width, priceHeight - suffixHeight - priceGapMm(style)),
    priceSuffix: box(width, suffixHeight),
    breakdownLabel: box(Math.max(6, labelWidth), breakdownRowHeightMm(style)),
    breakdownAmount: box(amountWidthMm(style), breakdownRowHeightMm(style)),
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
 * The maximum comes from the settings, scaled to the chosen grid; the minimum is
 * where text stops being readable across a shop, scaled the same way and clamped
 * so it can never exceed the maximum.
 */
export function fontRanges(style: LabelStyle = DEFAULT_LABEL_STYLE): Readonly<Record<StyleKey, FontRange>> {
  const scale = typeScale(style)
  const range = (minPx: number, maxPx: number): FontRange => {
    const top = maxPx * scale
    return { minPx: Math.min(minPx * scale, top * 0.6), maxPx: top }
  }

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

const mm = (value: number): string => `${Math.round(value * 1000) / 1000}mm`

/** Custom properties handed to the label element, so CSS reuses these numbers. */
export function labelCssVars(
  breakdownRows: number,
  breakdownHasArtNr = false,
  style: LabelStyle = DEFAULT_LABEL_STYLE
): Record<string, string> {
  return {
    '--label-w': mm(labelWidthMm(style)),
    '--label-h': mm(labelHeightMm(style)),
    '--label-pad': mm(paddingMm(style)),
    '--label-head-h': mm(headHeightMm(style)),
    '--label-foot-h': mm(footHeightMm(style)),
    '--label-name-h': mm(nameHeightMm(style)),
    '--label-subtitle-h': mm(subtitleHeightMm(style)),
    '--label-artnr-h': mm(artNrHeightMm(style)),
    '--label-head-gap': mm(headGapMm(style)),
    '--label-foot-gap': mm(footGapMm(style)),
    '--label-price-h': mm(priceBlockHeightMm(breakdownRows, style)),
    '--label-price-suffix-h': mm(priceSuffixHeightMm(style)),
    '--label-price-gap': mm(priceGapMm(style)),
    '--label-breakdown-h': mm(breakdownHeightMm(breakdownRows, style)),
    '--label-breakdown-gap': mm(breakdownGapMm(style)),
    '--label-breakdown-row-h': mm(breakdownRowHeightMm(style)),
    '--label-amount-w': mm(amountWidthMm(style)),
    '--label-artnr-col-w': mm(breakdownHasArtNr ? BASE_ARTNR_COLUMN_MM * widthScale(style) : 0),
    '--label-row-gap': mm(rowGapMm(style)),
    '--label-note-h': mm(noteHeightMm(style)),
    '--label-brand-h': mm(brandHeightMm(style))
  }
}

/** Custom properties for one A4 sheet and its grid. */
export function sheetCssVars(style: LabelStyle = DEFAULT_LABEL_STYLE): Record<string, string> {
  const grid = gridOf(style)
  return {
    '--sheet-w': mm(SHEET_WIDTH_MM),
    '--sheet-h': mm(SHEET_HEIGHT_MM),
    '--sheet-cols': String(grid.columns),
    '--sheet-rows': String(grid.rows),
    '--label-w': mm(labelWidthMm(style)),
    '--label-h': mm(labelHeightMm(style))
  }
}
