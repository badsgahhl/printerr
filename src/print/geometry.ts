import type { FitBox } from '@/lib/fit-text'
import type { PriceView } from '@/lib/price'
import type { Label } from '@/lib/types'

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
 * One size per text on the label, the margin, and how the sheet is divided.
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
  readonly subtitleMaxPx: number
  readonly artNrMaxPx: number
  readonly priceMaxPx: number
  /** The qualifier under the price, e.g. "ohne Figuren". */
  readonly priceSuffixMaxPx: number
  /** Add-on rows: description, article number and amount share one size. */
  readonly breakdownMaxPx: number
  /** The hint at the foot, e.g. "Ausgabe an der Kasse!". */
  readonly noteMaxPx: number
  /** The shop name. */
  readonly brandMaxPx: number
}

/** The style keys that are font sizes, as opposed to the grid and the margin. */
export type FontSizeKey = Exclude<keyof LabelStyle, 'columns' | 'rows' | 'paddingMm'>

/** Every font size, top to bottom in the order the texts sit on the label. */
export const FONT_SIZE_KEYS: readonly FontSizeKey[] = [
  'nameMaxPx',
  'subtitleMaxPx',
  'artNrMaxPx',
  'priceMaxPx',
  'priceSuffixMaxPx',
  'breakdownMaxPx',
  'noteMaxPx',
  'brandMaxPx'
]

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
  subtitleMaxPx: 15,
  artNrMaxPx: 12,
  priceMaxPx: 72,
  priceSuffixMaxPx: 15.5,
  breakdownMaxPx: 12,
  noteMaxPx: 11,
  brandMaxPx: 13
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
  subtitleMaxPx: { min: 8, max: 30, step: 0.5 },
  artNrMaxPx: { min: 7, max: 24, step: 0.5 },
  priceMaxPx: { min: 30, max: 110, step: 1 },
  priceSuffixMaxPx: { min: 8, max: 30, step: 0.5 },
  breakdownMaxPx: { min: 7, max: 22, step: 0.5 },
  // Roomier than the others: a hint like "Ausgabe an der Kasse!" is exactly what
  // a shop wants to shout, and it is short enough to take the size.
  noteMaxPx: { min: 7, max: 34, step: 0.5 },
  brandMaxPx: { min: 7, max: 26, step: 0.5 }
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

/**
 * What one label prints besides its name and price.
 *
 * Only what is printed takes up room. A label without a shop name gives that
 * space to the price instead of keeping it empty -- which is also what stops the
 * shop-name size from moving a label that has no shop name on it.
 */
export interface LabelContent {
  readonly breakdownRows: number
  /** Claims the article number column in every row as soon as one row has a number. */
  readonly breakdownHasArtNr: boolean
  readonly subtitle: boolean
  readonly artNr: boolean
  readonly priceSuffix: boolean
  readonly note: boolean
  readonly brand: boolean
  /**
   * The sizes the texts were fitted at, once they have been measured. A
   * single-line text that had to shrink then claims only the height it still
   * needs; until then everything claims its full height.
   */
  readonly fitPx?: Partial<Record<StyleKey, number>>
}

/** Read off a label exactly what PriceLabel is going to render, and nothing else. */
export function labelContent(
  label: Label,
  view: PriceView,
  brand: string | null,
  fitPx?: Partial<Record<StyleKey, number>>
): LabelContent {
  return {
    breakdownRows: view.breakdown.length,
    breakdownHasArtNr: view.breakdown.some((row) => row.artNr !== null),
    subtitle: Boolean(label.subtitle),
    artNr: Boolean(label.artNr),
    priceSuffix: Boolean(view.suffix),
    note: Boolean(label.note),
    brand: Boolean(brand),
    fitPx
  }
}

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

/** How far one text's box grows or shrinks: with its own size and with the label. */
const sizeScale = (style: LabelStyle, key: FontSizeKey): number =>
  (style[key] / DEFAULT_LABEL_STYLE[key]) * heightScale(style)

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

export const nameHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number =>
  BASE_NAME_MM * sizeScale(style, 'nameMaxPx')

export const subtitleHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number =>
  BASE_SUBTITLE_MM * sizeScale(style, 'subtitleMaxPx')

export const artNrHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number =>
  BASE_ART_NR_MM * sizeScale(style, 'artNrMaxPx')

const headGapMm = (style: LabelStyle): number => BASE_HEAD_GAP_MM * heightScale(style)
const footGapMm = (style: LabelStyle): number => BASE_FOOT_GAP_MM * heightScale(style)
const breakdownGapMm = (style: LabelStyle): number => BASE_BREAKDOWN_GAP_MM * heightScale(style)
const priceGapMm = (style: LabelStyle): number => BASE_PRICE_GAP_MM * heightScale(style)

export const noteHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number =>
  BASE_NOTE_MM * sizeScale(style, 'noteMaxPx')

export const brandHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number =>
  BASE_BRAND_MM * sizeScale(style, 'brandMaxPx')

export const breakdownRowHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number =>
  BASE_BREAKDOWN_ROW_MM * sizeScale(style, 'breakdownMaxPx')

/** Height of the small price qualifier under the big number. */
export const priceSuffixHeightMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number =>
  BASE_SUBTITLE_MM * sizeScale(style, 'priceSuffixMaxPx')

/**
 * How much of its full-size box a single-line text still needs.
 *
 * A text too wide for its maximum is shrunk to fit, and would otherwise keep the
 * height of the size it never got: turning its slider further up would then do
 * nothing to the text and only push the price aside. Instead the box shrinks
 * with the text, in proportion, so it keeps the same room around it as a text
 * set at that size in the first place. Where a row holds two texts, the larger
 * one decides.
 */
function shrinkOf(content: LabelContent, style: LabelStyle, keys: readonly StyleKey[]): number {
  const fitted = content.fitPx
  if (!fitted) return 1

  const ranges = fontRanges(style)
  let needed = 0
  for (const key of keys) {
    const size = fitted[key]
    if (size === undefined) return 1
    needed = Math.max(needed, size / ranges[key].maxPx)
  }
  return Math.min(1, needed)
}

interface TextHeights {
  readonly subtitle: number
  readonly artNr: number
  readonly priceSuffix: number
  readonly breakdownRow: number
  readonly note: number
  readonly brand: number
}

/** Heights of the single-line texts, as this label prints them. */
function textHeightsMm(content: LabelContent, style: LabelStyle): TextHeights {
  const fitted = (heightMm: number, ...keys: StyleKey[]): number => heightMm * shrinkOf(content, style, keys)
  return {
    subtitle: fitted(subtitleHeightMm(style), 'subtitle'),
    artNr: fitted(artNrHeightMm(style), 'artNr'),
    priceSuffix: fitted(priceSuffixHeightMm(style), 'priceSuffix'),
    breakdownRow: fitted(breakdownRowHeightMm(style), 'breakdownLabel', 'breakdownAmount'),
    note: fitted(noteHeightMm(style), 'note'),
    brand: fitted(brandHeightMm(style), 'brand')
  }
}

/** A text and the gap that separates it from the one above, or nothing when it is not printed. */
const stacked = (printed: boolean, heightMm: number, gapMm: number): number => (printed ? gapMm + heightMm : 0)

export function headHeightMm(content: LabelContent, style: LabelStyle = DEFAULT_LABEL_STYLE): number {
  const heights = textHeightsMm(content, style)
  const gap = headGapMm(style)
  return (
    nameHeightMm(style) + stacked(content.subtitle, heights.subtitle, gap) + stacked(content.artNr, heights.artNr, gap)
  )
}

export function footHeightMm(content: LabelContent, style: LabelStyle = DEFAULT_LABEL_STYLE): number {
  const heights = textHeightsMm(content, style)
  const note = content.note ? heights.note : 0
  return note + stacked(content.brand, heights.brand, content.note ? footGapMm(style) : 0)
}

export const amountWidthMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number =>
  BASE_AMOUNT_WIDTH_MM * widthScale(style)

export const rowGapMm = (style: LabelStyle = DEFAULT_LABEL_STYLE): number => BASE_ROW_GAP_MM * widthScale(style)

/** Width the article number column takes up, gap included. */
export function breakdownArtNrWidthMm(hasArtNr: boolean, style: LabelStyle = DEFAULT_LABEL_STYLE): number {
  return hasArtNr ? BASE_ARTNR_COLUMN_MM * widthScale(style) + rowGapMm(style) : 0
}

/** How tall the breakdown block is, for as many rows as the label prints. */
export function breakdownHeightMm(content: LabelContent, style: LabelStyle = DEFAULT_LABEL_STYLE): number {
  const rows = content.breakdownRows
  return rows <= 0 ? 0 : breakdownGapMm(style) + rows * textHeightsMm(content, style).breakdownRow
}

/** What is left for the price once head, foot and breakdown have taken their share. */
export function priceBlockHeightMm(content: LabelContent, style: LabelStyle = DEFAULT_LABEL_STYLE): number {
  const remaining =
    contentHeightMm(style) -
    headHeightMm(content, style) -
    footHeightMm(content, style) -
    breakdownHeightMm(content, style)
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
 * A pure function of what the label prints and the style, so it can be tested
 * without a browser and cannot disagree with the stylesheet.
 */
export function labelBoxes(content: LabelContent, style: LabelStyle = DEFAULT_LABEL_STYLE): LabelBoxes {
  const width = contentWidthMm(style)
  const heights = textHeightsMm(content, style)
  const priceHeight = priceBlockHeightMm(content, style)
  const labelWidth =
    width - amountWidthMm(style) - breakdownArtNrWidthMm(content.breakdownHasArtNr, style) - rowGapMm(style)

  return {
    name: box(width, nameHeightMm(style)),
    subtitle: box(width, heights.subtitle),
    artNr: box(width, heights.artNr),
    price: box(width, priceHeight - stacked(content.priceSuffix, heights.priceSuffix, priceGapMm(style))),
    priceSuffix: box(width, heights.priceSuffix),
    breakdownLabel: box(Math.max(6, labelWidth), heights.breakdownRow),
    breakdownAmount: box(amountWidthMm(style), heights.breakdownRow),
    note: box(width, heights.note),
    brand: box(width, heights.brand)
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
    subtitle: range(7, style.subtitleMaxPx),
    artNr: range(7, style.artNrMaxPx),
    price: range(22, style.priceMaxPx),
    priceSuffix: range(8, style.priceSuffixMaxPx),
    breakdownLabel: range(6.5, style.breakdownMaxPx),
    breakdownAmount: range(6.5, style.breakdownMaxPx),
    note: range(6.5, style.noteMaxPx),
    brand: range(7, style.brandMaxPx)
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
export function labelCssVars(content: LabelContent, style: LabelStyle = DEFAULT_LABEL_STYLE): Record<string, string> {
  const heights = textHeightsMm(content, style)
  return {
    '--label-w': mm(labelWidthMm(style)),
    '--label-h': mm(labelHeightMm(style)),
    '--label-pad': mm(paddingMm(style)),
    '--label-head-h': mm(headHeightMm(content, style)),
    '--label-foot-h': mm(footHeightMm(content, style)),
    '--label-name-h': mm(nameHeightMm(style)),
    '--label-subtitle-h': mm(heights.subtitle),
    '--label-artnr-h': mm(heights.artNr),
    '--label-head-gap': mm(headGapMm(style)),
    '--label-foot-gap': mm(footGapMm(style)),
    '--label-price-h': mm(priceBlockHeightMm(content, style)),
    '--label-price-suffix-h': mm(heights.priceSuffix),
    '--label-price-gap': mm(priceGapMm(style)),
    '--label-breakdown-h': mm(breakdownHeightMm(content, style)),
    '--label-breakdown-gap': mm(breakdownGapMm(style)),
    '--label-breakdown-row-h': mm(heights.breakdownRow),
    '--label-amount-w': mm(amountWidthMm(style)),
    '--label-artnr-col-w': mm(content.breakdownHasArtNr ? BASE_ARTNR_COLUMN_MM * widthScale(style) : 0),
    '--label-row-gap': mm(rowGapMm(style)),
    '--label-note-h': mm(heights.note),
    '--label-brand-h': mm(heights.brand)
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
