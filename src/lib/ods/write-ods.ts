import { strToU8, zipSync } from 'fflate'

import { NS, ODS_MIME } from '@/lib/ods/ns'

/**
 * Minimal OpenDocument Spreadsheet writer.
 *
 * It exists to produce the template and example files the shop edits, and to
 * generate fixtures for the reader. It writes only what those need: strings,
 * numbers, currency-formatted numbers and empty cells.
 */

export type CellValue =
  | { readonly kind: 'empty' }
  | { readonly kind: 'string'; readonly text: string }
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'currency'; readonly cents: number }

export interface SheetData {
  readonly name: string
  readonly rows: readonly (readonly CellValue[])[]
}

export const empty = (): CellValue => ({ kind: 'empty' })
export const str = (text: string): CellValue => ({ kind: 'string', text })
export const num = (value: number): CellValue => ({ kind: 'number', value })
export const eur = (cents: number): CellValue => ({ kind: 'currency', cents })

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

/**
 * Render the display text Calc would show for an amount.
 *
 * Written into <text:p> while the machine-readable value goes into
 * @office:value -- which is exactly the split the reader has to respect.
 */
function displayCurrency(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const absolute = Math.abs(cents)
  const whole = Math.trunc(absolute / 100)
  const fraction = String(absolute % 100).padStart(2, '0')
  const grouped = String(whole).replaceAll(/\B(?=(\d{3})+(?!\d))/gu, '.')
  return `${sign}${grouped},${fraction} €`
}

function cellXml(cell: CellValue): string {
  switch (cell.kind) {
    case 'empty':
      return '<table:table-cell/>'
    case 'string':
      return `<table:table-cell office:value-type="string"><text:p>${escapeXml(cell.text)}</text:p></table:table-cell>`
    case 'number':
      return (
        `<table:table-cell office:value-type="float" office:value="${cell.value}">` +
        `<text:p>${escapeXml(String(cell.value).replace('.', ','))}</text:p></table:table-cell>`
      )
    case 'currency': {
      // office:value is always dot-decimal per the spec, regardless of locale.
      const value = (cell.cents / 100).toFixed(2)
      return (
        `<table:table-cell table:style-name="ce-currency" office:value-type="currency" ` +
        `office:currency="EUR" office:value="${value}">` +
        `<text:p>${escapeXml(displayCurrency(cell.cents))}</text:p></table:table-cell>`
      )
    }
  }
}

function rowXml(row: readonly CellValue[]): string {
  return `<table:table-row>${row.map((cell) => cellXml(cell)).join('')}</table:table-row>`
}

function sheetXml(sheet: SheetData): string {
  const columns = Math.max(1, ...sheet.rows.map((row) => row.length))
  return (
    `<table:table table:name="${escapeXml(sheet.name)}">` +
    `<table:table-column table:number-columns-repeated="${columns}"/>` +
    sheet.rows.map((row) => rowXml(row)).join('') +
    '</table:table>'
  )
}

const CONTENT_ATTRS = [
  `xmlns:office="${NS.office}"`,
  `xmlns:table="${NS.table}"`,
  `xmlns:text="${NS.text}"`,
  `xmlns:style="${NS.style}"`,
  `xmlns:number="${NS.number}"`,
  `xmlns:fo="${NS.fo}"`,
  'office:version="1.3"'
].join(' ')

// A euro format so the template opens in Calc already looking like a price list.
const AUTOMATIC_STYLES =
  '<office:automatic-styles>' +
  '<number:currency-style style:name="N-euro" style:volatile="true">' +
  '<number:number number:decimal-places="2" number:min-decimal-places="2" ' +
  'number:min-integer-digits="1" number:grouping="true"/>' +
  '<number:text> </number:text>' +
  '<number:currency-symbol number:language="de" number:country="DE">€</number:currency-symbol>' +
  '</number:currency-style>' +
  '<style:style style:name="ce-currency" style:family="table-cell" style:parent-style-name="Default" ' +
  'style:data-style-name="N-euro"/>' +
  '</office:automatic-styles>'

function contentXml(sheets: readonly SheetData[]): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<office:document-content ${CONTENT_ATTRS}>` +
    AUTOMATIC_STYLES +
    '<office:body><office:spreadsheet>' +
    sheets.map((sheet) => sheetXml(sheet)).join('') +
    '</office:spreadsheet></office:body></office:document-content>'
  )
}

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  `<office:document-styles xmlns:office="${NS.office}" xmlns:style="${NS.style}" ` +
  `xmlns:fo="${NS.fo}" office:version="1.3">` +
  '<office:styles/></office:document-styles>'

const MANIFEST_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  `<manifest:manifest xmlns:manifest="${NS.manifest}" manifest:version="1.3">` +
  `<manifest:file-entry manifest:full-path="/" manifest:media-type="${ODS_MIME}"/>` +
  '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>' +
  '<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>' +
  '</manifest:manifest>'

export function writeOds(sheets: readonly SheetData[]): Uint8Array {
  // ODF requires mimetype to be the first entry and stored uncompressed; fflate
  // keeps insertion order, and level 0 means store.
  return zipSync({
    mimetype: [strToU8(ODS_MIME), { level: 0 }],
    'META-INF/manifest.xml': strToU8(MANIFEST_XML),
    'styles.xml': strToU8(STYLES_XML),
    'content.xml': strToU8(contentXml(sheets))
  })
}
