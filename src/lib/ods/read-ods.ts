import { strFromU8, unzipSync } from 'fflate'

import { NS } from '@/lib/ods/ns'
import type { Diagnostic } from '@/lib/types'

/**
 * OpenDocument Spreadsheet reader.
 *
 * A .ods is a ZIP whose content.xml holds the sheets. Only that entry is
 * decompressed; styles.xml and thumbnails are skipped.
 *
 * Requires a DOMParser, so it runs in the browser or under jsdom, not in bare Node.
 */

/** Guard rails against a sheet whose repeat counters claim the whole grid. */
export const MAX_COLS = 256
export const MAX_ROWS = 50_000

export interface RawCell {
  /** The display text, i.e. what the seller sees in the cell. */
  readonly text: string
  /** The machine-readable value, present for float, percentage and currency cells. */
  readonly number: number | null
}

export interface RawSheet {
  readonly name: string
  readonly rows: readonly (readonly RawCell[])[]
}

export interface WorkbookReadResult {
  readonly sheets: readonly RawSheet[]
  readonly diagnostics: readonly Diagnostic[]
}

const EMPTY_CELL: RawCell = { text: '', number: null }

const TEXT_NODE = 3
const ELEMENT_NODE = 1

function fatal(message: string, sheet: string | null = null): Diagnostic {
  return { severity: 'error', code: 'missing-sheet', sheet, row: null, column: null, labelId: null, message }
}

/** Number of columns or rows this element stands for. Defaults to 1, never expanded blindly. */
function repeatCount(element: Element, attribute: string): number {
  const raw = element.getAttributeNS(NS.table, attribute)
  if (raw === null) return 1
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

/**
 * Flatten the inline markup of one <text:p>.
 *
 * textContent alone would drop <text:line-break/> and collapse <text:s/>, so a
 * two-line cell would come back as one run-on string.
 */
function paragraphText(node: Node): string {
  let out = ''
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === TEXT_NODE) {
      out += child.nodeValue ?? ''
      continue
    }
    if (child.nodeType !== ELEMENT_NODE) continue

    const element = child as Element
    if (element.namespaceURI === NS.text) {
      if (element.localName === 'line-break') {
        out += '\n'
        continue
      }
      if (element.localName === 'tab') {
        out += '\t'
        continue
      }
      if (element.localName === 's') {
        const count = Number.parseInt(element.getAttributeNS(NS.text, 'c') ?? '1', 10)
        out += ' '.repeat(Number.isFinite(count) && count > 0 ? count : 1)
        continue
      }
    }
    out += paragraphText(element)
  }
  return out
}

/** Direct <text:p> children only -- nested ones belong to annotations, not the value. */
function cellText(cell: Element): string {
  const paragraphs: string[] = []
  for (const child of Array.from(cell.children)) {
    if (child.namespaceURI === NS.text && child.localName === 'p') paragraphs.push(paragraphText(child))
  }
  return paragraphs.join('\n')
}

function readCell(cell: Element): RawCell {
  const valueType = cell.getAttributeNS(NS.office, 'value-type')

  if (valueType === 'boolean') {
    // Surfaced as text so the shared boolean parser handles it like a typed "ja".
    return { text: cell.getAttributeNS(NS.office, 'boolean-value') ?? cellText(cell), number: null }
  }

  let numeric: number | null = null
  if (valueType === 'float' || valueType === 'percentage' || valueType === 'currency') {
    // office:value is always dot-decimal; <text:p> carries the localised display
    // text ("1.148,00 €") and must never be used as the number.
    const parsed = Number.parseFloat(cell.getAttributeNS(NS.office, 'value') ?? '')
    numeric = Number.isFinite(parsed) ? parsed : null
  }

  return { text: cellText(cell), number: numeric }
}

function isEmpty(cell: RawCell): boolean {
  return cell.text.length === 0 && cell.number === null
}

function readRow(row: Element, onLimit: () => void): RawCell[] {
  const cells: RawCell[] = []
  let column = 0

  for (const child of Array.from(row.children)) {
    if (child.namespaceURI !== NS.table) continue

    const isCell = child.localName === 'table-cell'
    const isCovered = child.localName === 'covered-table-cell'
    if (!isCell && !isCovered) continue

    const repeat = repeatCount(child, 'number-columns-repeated')

    // A covered cell is a grid position swallowed by a merge. It holds no value
    // of its own, but skipping it would shift every column to its right.
    const value = isCovered ? EMPTY_CELL : readCell(child)

    if (isEmpty(value)) {
      column += repeat
      continue
    }

    while (cells.length < column) cells.push(EMPTY_CELL)
    for (let index = 0; index < repeat; index += 1) {
      if (cells.length >= MAX_COLS) {
        onLimit()
        return cells
      }
      cells.push(value)
      column += 1
    }
  }

  return cells
}

function readSheet(table: Element, diagnostics: Diagnostic[]): RawSheet {
  const name = table.getAttributeNS(NS.table, 'name') ?? ''
  const rows: RawCell[][] = []
  let truncated = false
  const flagLimit = () => {
    if (truncated) return
    truncated = true
    diagnostics.push({
      severity: 'warning',
      code: 'sheet-too-large',
      sheet: name,
      row: null,
      column: null,
      labelId: null,
      message:
        `Das Blatt „${name}" ist größer als ${MAX_ROWS} Zeilen oder ${MAX_COLS} Spalten. ` +
        'Der Rest wurde nicht gelesen.'
    })
  }

  // Rows are not necessarily direct children: table:table-header-rows and
  // table:table-row-group are legal wrappers, so this searches descendants.
  const rowElements = table.getElementsByTagNameNS(NS.table, 'table-row')

  for (const rowElement of Array.from(rowElements)) {
    const cells = readRow(rowElement, flagLimit)
    const repeat = repeatCount(rowElement, 'number-rows-repeated')

    if (cells.length === 0) {
      // Empty rows are only placeholders. Calc writes one with a repeat count of
      // a million at the end of every sheet; materialising that would be fatal.
      if (rows.length > 0) {
        const gap = Math.min(repeat, MAX_ROWS - rows.length)
        for (let index = 0; index < gap; index += 1) rows.push([])
      }
      continue
    }

    for (let index = 0; index < repeat; index += 1) {
      if (rows.length >= MAX_ROWS) {
        flagLimit()
        break
      }
      rows.push(cells)
    }
  }

  // Trailing blank rows carry no information and would only pad diagnostics.
  while (rows.length > 0 && (rows.at(-1)?.length ?? 0) === 0) rows.pop()

  return { name, rows }
}

function parseXml(xml: string): { document: Document } | { error: string } {
  const parsed = new DOMParser().parseFromString(xml, 'application/xml')
  // DOMParser does not throw on malformed XML; it returns a document whose root
  // is a <parsererror> instead.
  const failure = parsed.getElementsByTagName('parsererror')[0]
  if (failure) return { error: failure.textContent?.trim() ?? 'Unbekannter XML-Fehler' }
  return { document: parsed }
}

export function readOds(bytes: Uint8Array): WorkbookReadResult {
  const diagnostics: Diagnostic[] = []

  let content: string
  try {
    const entries = unzipSync(bytes, { filter: (file) => file.name === 'content.xml' })
    const raw = entries['content.xml']
    if (!raw) {
      return {
        sheets: [],
        diagnostics: [fatal('Die Datei enthält keine content.xml — ist das wirklich eine .ods-Datei?')]
      }
    }
    content = strFromU8(raw)
  } catch {
    return {
      sheets: [],
      diagnostics: [fatal('Die Datei konnte nicht entpackt werden — ist das wirklich eine .ods-Datei?')]
    }
  }

  const parsed = parseXml(content)
  if ('error' in parsed) {
    return { sheets: [], diagnostics: [fatal(`Die Tabelle ist beschädigt: ${parsed.error}`)] }
  }

  const tables = parsed.document.getElementsByTagNameNS(NS.table, 'table')
  const sheets = Array.from(tables).map((table) => readSheet(table, diagnostics))

  if (sheets.length === 0) diagnostics.push(fatal('Die Datei enthält keine Tabellenblätter.'))

  return { sheets, diagnostics }
}
