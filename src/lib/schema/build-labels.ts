import type { RawCell, RawSheet } from '@/lib/ods/read-ods'
import { exhibitedWithoutPrice } from '@/lib/price'
import {
  EXTRA_COLUMNS,
  EXTRA_SHEET,
  EXTRA_SHEET_ALIASES,
  type ExtraField,
  mapHeadings,
  normalizeHeading,
  PRODUCT_COLUMNS,
  PRODUCT_SHEET,
  PRODUCT_SHEET_ALIASES,
  type ProductField,
  REQUIRED_EXTRA_FIELDS,
  REQUIRED_PRODUCT_FIELDS
} from '@/lib/schema/columns'
import { parseBoolean, parseCents, parseCount, type ParseResult } from '@/lib/schema/parse-number'
import type { Diagnostic, Label, LabelExtra } from '@/lib/types'

/**
 * Turn raw sheets into printable labels, collecting every problem on the way.
 *
 * Nothing here throws. A price list with mistakes in it still has to produce the
 * labels that are fine, plus a list of what to fix -- the seller is standing at
 * the counter, not debugging.
 */

export interface BuildResult {
  readonly labels: readonly Label[]
  readonly diagnostics: readonly Diagnostic[]
}

/** German column names for diagnostics, so a message points at what is in the file. */
const PRODUCT_FIELD_NAMES: Readonly<Record<ProductField, string>> = {
  id: 'ID',
  name: 'Name',
  subtitle: 'Untertitel',
  artNr: 'ArtNr',
  price: 'Preis',
  priceNote: 'Preiszusatz',
  note: 'Hinweis',
  copies: 'Anzahl',
  print: 'Drucken',
  layout: 'Layout'
}

const EXTRA_FIELD_NAMES: Readonly<Record<ExtraField, string>> = {
  productId: 'ProduktID',
  name: 'Bezeichnung',
  artNr: 'ArtNr',
  price: 'Preis',
  priceText: 'Preistext',
  exhibited: 'Ausgestellt'
}

/** How far down to look for the heading row, in case someone put a title above the table. */
const HEADER_SEARCH_DEPTH = 10

const EMPTY_CELL: RawCell = { text: '', number: null }

function cellAt(row: readonly RawCell[], index: number | undefined): RawCell {
  if (index === undefined) return EMPTY_CELL
  return row[index] ?? EMPTY_CELL
}

function textAt(row: readonly RawCell[], index: number | undefined): string {
  return cellAt(row, index).text.trim()
}

function optionalTextAt(row: readonly RawCell[], index: number | undefined): string | null {
  const text = textAt(row, index)
  return text.length === 0 ? null : text
}

/**
 * Read a price cell as integer cents.
 *
 * A numeric cell carries a dot-decimal double in office:value; rounding it is
 * exact for any price a shop would charge. Only a cell someone typed as text
 * goes through the German parser.
 */
function readPriceCents(cell: RawCell): ParseResult {
  if (cell.number !== null) {
    const cents = Math.round(cell.number * 100)
    return Number.isSafeInteger(cents) ? { ok: true, value: cents } : { ok: false, reason: 'out-of-range' }
  }
  return parseCents(cell.text)
}

function findSheet(sheets: readonly RawSheet[], aliases: readonly string[]): RawSheet | null {
  return sheets.find((sheet) => aliases.includes(normalizeHeading(sheet.name))) ?? null
}

interface Header<T extends string> {
  readonly row: number
  readonly map: Readonly<Partial<Record<T, number>>>
}

/** Pick the row that binds the most required fields; ties go to the topmost. */
function findHeader<T extends string>(
  sheet: RawSheet,
  aliases: Readonly<Record<T, readonly string[]>>,
  required: readonly T[]
): Header<T> {
  let best = { row: 0, map: {} as Partial<Record<T, number>>, score: -1 }
  const depth = Math.min(sheet.rows.length, HEADER_SEARCH_DEPTH)

  for (let index = 0; index < depth; index += 1) {
    const headings = (sheet.rows[index] ?? []).map((cell) => cell.text)
    const map = mapHeadings(headings, aliases)
    const score = required.filter((field) => map[field] !== undefined).length

    if (score > best.score) best = { row: index, map, score }
    if (score === required.length) break
  }

  return { row: best.row, map: best.map }
}

function isBlankRow(row: readonly RawCell[]): boolean {
  return row.every((cell) => cell.text.trim().length === 0 && cell.number === null)
}

interface Context {
  readonly diagnostics: Diagnostic[]
}

function reportMissingColumns<T extends string>(
  { diagnostics }: Context,
  sheetName: string,
  header: Header<T>,
  required: readonly T[],
  names: Readonly<Record<T, string>>
): boolean {
  const missing = required.filter((field) => header.map[field] === undefined)
  if (missing.length === 0) return true

  diagnostics.push({
    severity: 'error',
    code: 'missing-column',
    sheet: sheetName,
    row: header.row + 1,
    column: null,
    labelId: null,
    message:
      `Im Blatt „${sheetName}" fehlen die Spalten ${missing.map((field) => `„${names[field]}"`).join(', ')}. ` +
      'Die Kopfzeile muss diese Überschriften enthalten.'
  })
  return false
}

function readExtras(sheets: readonly RawSheet[], context: Context): Map<string, LabelExtra[]> {
  const byProduct = new Map<string, LabelExtra[]>()
  const sheet = findSheet(sheets, EXTRA_SHEET_ALIASES)
  // The Zusätze sheet is optional: a shop with only simple labels never needs it.
  if (!sheet || sheet.rows.length === 0) return byProduct

  const header = findHeader(sheet, EXTRA_COLUMNS, REQUIRED_EXTRA_FIELDS)
  if (!reportMissingColumns(context, sheet.name, header, REQUIRED_EXTRA_FIELDS, EXTRA_FIELD_NAMES)) return byProduct

  const { map } = header
  for (let index = header.row + 1; index < sheet.rows.length; index += 1) {
    const row = sheet.rows[index] ?? []
    if (isBlankRow(row)) continue
    const rowNumber = index + 1

    const productId = textAt(row, map.productId)
    const name = textAt(row, map.name)
    if (productId.length === 0 && name.length === 0) continue

    if (productId.length === 0) {
      context.diagnostics.push({
        severity: 'error',
        code: 'missing-id',
        sheet: sheet.name,
        row: rowNumber,
        column: EXTRA_FIELD_NAMES.productId,
        labelId: null,
        message: `Zeile ${rowNumber}: „${name}" hat keine ProduktID und kann keinem Schild zugeordnet werden.`
      })
      continue
    }

    const priceCell = cellAt(row, map.price)
    const priceText = optionalTextAt(row, map.priceText)
    let priceCents: number | null = null

    const parsed = readPriceCents(priceCell)
    if (parsed.ok) {
      priceCents = parsed.value
    } else if (parsed.reason !== 'empty') {
      context.diagnostics.push({
        severity: 'warning',
        code: 'bad-price',
        sheet: sheet.name,
        row: rowNumber,
        column: EXTRA_FIELD_NAMES.price,
        labelId: productId,
        message:
          `Zeile ${rowNumber}: „${priceCell.text}" ist kein Preis. ` +
          'Freie Angaben wie „ab 90,00 €" gehören in die Spalte „Preistext".'
      })
    }

    if (priceCents === null && priceText === null) {
      context.diagnostics.push({
        severity: 'warning',
        code: 'extra-without-price',
        sheet: sheet.name,
        row: rowNumber,
        column: EXTRA_FIELD_NAMES.price,
        labelId: productId,
        message: `Zeile ${rowNumber}: „${name}" hat weder Preis noch Preistext und bleibt auf dem Schild ohne Betrag.`
      })
    }

    const extra: LabelExtra = {
      name,
      artNr: optionalTextAt(row, map.artNr),
      priceCents,
      priceText,
      exhibited: parseBoolean(textAt(row, map.exhibited)) ?? false
    }

    const bucket = byProduct.get(productId)
    if (bucket) bucket.push(extra)
    else byProduct.set(productId, [extra])
  }

  return byProduct
}

export function buildLabels(sheets: readonly RawSheet[]): BuildResult {
  const context: Context = { diagnostics: [] }

  let productSheet = findSheet(sheets, PRODUCT_SHEET_ALIASES)
  if (!productSheet && sheets.length === 1 && sheets[0]) {
    // A single unnamed sheet is almost certainly the product list; say so rather
    // than refusing the file over a sheet name.
    productSheet = sheets[0]
    context.diagnostics.push({
      severity: 'warning',
      code: 'missing-sheet',
      sheet: productSheet.name,
      row: null,
      column: null,
      labelId: null,
      message: `Kein Blatt namens „${PRODUCT_SHEET}" gefunden — „${productSheet.name}" wird stattdessen gelesen.`
    })
  }

  if (!productSheet) {
    context.diagnostics.push({
      severity: 'error',
      code: 'missing-sheet',
      sheet: null,
      row: null,
      column: null,
      labelId: null,
      message:
        `Die Datei enthält kein Blatt namens „${PRODUCT_SHEET}". ` +
        `Gefunden wurden: ${sheets.map((sheet) => `„${sheet.name}"`).join(', ') || 'keine Blätter'}.`
    })
    return { labels: [], diagnostics: context.diagnostics }
  }

  const header = findHeader(productSheet, PRODUCT_COLUMNS, REQUIRED_PRODUCT_FIELDS)
  if (!reportMissingColumns(context, productSheet.name, header, REQUIRED_PRODUCT_FIELDS, PRODUCT_FIELD_NAMES)) {
    return { labels: [], diagnostics: context.diagnostics }
  }

  const extrasByProduct = readExtras(sheets, context)
  const { map } = header
  const labels: Label[] = []
  const seenIds = new Map<string, number>()

  for (let index = header.row + 1; index < productSheet.rows.length; index += 1) {
    const row = productSheet.rows[index] ?? []
    if (isBlankRow(row)) continue
    const rowNumber = index + 1

    const id = textAt(row, map.id)
    const name = textAt(row, map.name)
    if (id.length === 0 && name.length === 0) continue

    if (id.length === 0) {
      context.diagnostics.push({
        severity: 'error',
        code: 'missing-id',
        sheet: productSheet.name,
        row: rowNumber,
        column: PRODUCT_FIELD_NAMES.id,
        labelId: null,
        message: `Zeile ${rowNumber}: „${name}" hat keine ID. Ohne ID lassen sich keine Zusätze zuordnen.`
      })
      continue
    }

    const firstSeen = seenIds.get(id)
    if (firstSeen !== undefined) {
      context.diagnostics.push({
        severity: 'error',
        code: 'duplicate-id',
        sheet: productSheet.name,
        row: rowNumber,
        column: PRODUCT_FIELD_NAMES.id,
        labelId: id,
        message: `Zeile ${rowNumber}: Die ID „${id}" kommt schon in Zeile ${firstSeen} vor.`
      })
      continue
    }
    seenIds.set(id, rowNumber)

    if (name.length === 0) {
      context.diagnostics.push({
        severity: 'error',
        code: 'missing-name',
        sheet: productSheet.name,
        row: rowNumber,
        column: PRODUCT_FIELD_NAMES.name,
        labelId: id,
        message: `Zeile ${rowNumber}: Schild „${id}" hat keinen Namen.`
      })
      continue
    }

    const priceCell = cellAt(row, map.price)
    const price = readPriceCents(priceCell)
    if (!price.ok) {
      context.diagnostics.push({
        severity: 'error',
        code: 'bad-price',
        sheet: productSheet.name,
        row: rowNumber,
        column: PRODUCT_FIELD_NAMES.price,
        labelId: id,
        message:
          price.reason === 'empty'
            ? `Zeile ${rowNumber}: „${name}" hat keinen Preis.`
            : `Zeile ${rowNumber}: „${priceCell.text}" ist kein gültiger Preis für „${name}".`
      })
      continue
    }

    const copies = parseCount(textAt(row, map.copies))

    const label: Label = {
      id,
      name,
      subtitle: optionalTextAt(row, map.subtitle),
      artNr: optionalTextAt(row, map.artNr),
      priceCents: price.value,
      priceNote: optionalTextAt(row, map.priceNote),
      note: optionalTextAt(row, map.note),
      copies: copies.ok && copies.value > 0 ? copies.value : 1,
      preselected: parseBoolean(textAt(row, map.print)) ?? true,
      layout: optionalTextAt(row, map.layout),
      extras: extrasByProduct.get(id) ?? [],
      sourceRow: rowNumber
    }

    // The PAngV rule, enforced by the data: a piece standing in the shop with
    // add-ons must be able to state one final price. An exhibited add-on without
    // a number makes that impossible, so the label is flagged and left unselected.
    const unpriced = exhibitedWithoutPrice(label)
    for (const extra of unpriced) {
      context.diagnostics.push({
        severity: 'error',
        code: 'exhibited-without-price',
        sheet: EXTRA_SHEET,
        row: null,
        column: EXTRA_FIELD_NAMES.price,
        labelId: id,
        message:
          `„${extra.name}" steht bei „${name}" in der Ausstellung, hat aber keinen Preis. ` +
          'Ohne Betrag lässt sich der Preis des ausgestellten Stücks nicht ausweisen.'
      })
    }

    labels.push(unpriced.length > 0 ? { ...label, preselected: false } : label)
  }

  const knownIds = new Set(labels.map((label) => label.id))
  for (const productId of extrasByProduct.keys()) {
    if (knownIds.has(productId)) continue
    context.diagnostics.push({
      severity: 'error',
      code: 'unknown-product',
      sheet: EXTRA_SHEET,
      row: null,
      column: EXTRA_FIELD_NAMES.productId,
      labelId: productId,
      message: `Im Blatt „${EXTRA_SHEET}" verweisen Zeilen auf die ProduktID „${productId}", die es nicht gibt.`
    })
  }

  return { labels, diagnostics: context.diagnostics }
}
