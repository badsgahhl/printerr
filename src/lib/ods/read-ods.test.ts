import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import { NS } from '@/lib/ods/ns'
import { MAX_COLS, MAX_ROWS, readOds } from '@/lib/ods/read-ods'
import { eur, num, str, writeOds } from '@/lib/ods/write-ods'

const NS_ATTRS = [`xmlns:office="${NS.office}"`, `xmlns:table="${NS.table}"`, `xmlns:text="${NS.text}"`].join(' ')

/**
 * Pack a hand-written content.xml into a .ods.
 *
 * The writer only ever emits tidy XML, so the awkward shapes Calc actually
 * produces -- repeat counters, merged cells, wrapped row groups -- have to be
 * written by hand to be tested at all.
 */
function odsWithBody(body: string): Uint8Array {
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<office:document-content ${NS_ATTRS} office:version="1.3">` +
    `<office:body><office:spreadsheet>${body}</office:spreadsheet></office:body>` +
    '</office:document-content>'
  return zipSync({ 'content.xml': strToU8(xml) })
}

const cell = (text: string): string =>
  `<table:table-cell office:value-type="string"><text:p>${text}</text:p></table:table-cell>`

describe('readOds round trip', () => {
  it('reads back what the writer produced', () => {
    const bytes = writeOds([
      {
        name: 'Produkte',
        rows: [
          [str('ID'), str('Name'), str('Preis')],
          [str('R-01'), str('Räuchermann'), eur(8900)]
        ]
      },
      { name: 'Zusätze', rows: [[str('ProduktID')], [str('R-01')]] }
    ])

    const { sheets, diagnostics } = readOds(bytes)

    expect(diagnostics).toEqual([])
    expect(sheets.map((sheet) => sheet.name)).toEqual(['Produkte', 'Zusätze'])
    expect(sheets[0]?.rows[0]?.map((c) => c.text)).toEqual(['ID', 'Name', 'Preis'])
    expect(sheets[0]?.rows[1]?.[1]?.text).toBe('Räuchermann')
  })

  it('keeps umlauts intact through the zip', () => {
    const { sheets } = readOds(writeOds([{ name: 'Zusätze', rows: [[str('Mühle „Seiffen" · Größe')]] }]))

    expect(sheets[0]?.name).toBe('Zusätze')
    expect(sheets[0]?.rows[0]?.[0]?.text).toBe('Mühle „Seiffen" · Größe')
  })
})

describe('readOds value handling', () => {
  it('takes numbers from the attribute, not from the display text', () => {
    // The trap: <text:p> holds the localised "1.148,00 €", which parses to
    // something else entirely if mistaken for the value.
    const { sheets } = readOds(
      odsWithBody(
        '<table:table table:name="T"><table:table-row>' +
          '<table:table-cell office:value-type="currency" office:currency="EUR" office:value="1148">' +
          '<text:p>1.148,00 €</text:p></table:table-cell>' +
          '</table:table-row></table:table>'
      )
    )

    expect(sheets[0]?.rows[0]?.[0]?.number).toBe(1148)
    expect(sheets[0]?.rows[0]?.[0]?.text).toBe('1.148,00 €')
  })

  it('reads floats written by the writer', () => {
    const { sheets } = readOds(writeOds([{ name: 'T', rows: [[num(2), eur(12_345)]] }]))

    expect(sheets[0]?.rows[0]?.[0]?.number).toBe(2)
    expect(sheets[0]?.rows[0]?.[1]?.number).toBeCloseTo(123.45, 10)
  })

  it('surfaces booleans as text so the shared parser can read them', () => {
    const { sheets } = readOds(
      odsWithBody(
        '<table:table table:name="T"><table:table-row>' +
          '<table:table-cell office:value-type="boolean" office:boolean-value="true">' +
          '<text:p>WAHR</text:p></table:table-cell>' +
          '</table:table-row></table:table>'
      )
    )

    expect(sheets[0]?.rows[0]?.[0]?.text).toBe('true')
  })

  it('preserves line breaks and multiple paragraphs in one cell', () => {
    const { sheets } = readOds(
      odsWithBody(
        '<table:table table:name="T"><table:table-row>' +
          '<table:table-cell office:value-type="string">' +
          '<text:p>erste<text:line-break/>zweite</text:p><text:p>dritte</text:p>' +
          '</table:table-cell></table:table-row></table:table>'
      )
    )

    expect(sheets[0]?.rows[0]?.[0]?.text).toBe('erste\nzweite\ndritte')
  })
})

describe('readOds repeat counters', () => {
  it('expands a repeated filled cell across columns', () => {
    const { sheets } = readOds(
      odsWithBody(
        '<table:table table:name="T"><table:table-row>' +
          '<table:table-cell office:value-type="string" table:number-columns-repeated="3">' +
          '<text:p>x</text:p></table:table-cell>' +
          cell('Ende') +
          '</table:table-row></table:table>'
      )
    )

    expect(sheets[0]?.rows[0]?.map((c) => c.text)).toEqual(['x', 'x', 'x', 'Ende'])
  })

  it('uses a repeated empty cell as a gap rather than filling it in', () => {
    const { sheets } = readOds(
      odsWithBody(
        '<table:table table:name="T"><table:table-row>' +
          cell('A') +
          '<table:table-cell table:number-columns-repeated="4"/>' +
          cell('B') +
          '</table:table-row></table:table>'
      )
    )

    expect(sheets[0]?.rows[0]).toHaveLength(6)
    expect(sheets[0]?.rows[0]?.[5]?.text).toBe('B')
    expect(sheets[0]?.rows[0]?.[2]?.text).toBe('')
  })

  it('survives the million-row repeat Calc writes at the end of every sheet', () => {
    // A naive parser materialises 1048576 rows here and dies.
    const started = Date.now()
    const { sheets } = readOds(
      odsWithBody(
        '<table:table table:name="T">' +
          `<table:table-row>${cell('A')}</table:table-row>` +
          '<table:table-row table:number-rows-repeated="1048576"><table:table-cell ' +
          'table:number-columns-repeated="16384"/></table:table-row>' +
          '</table:table>'
      )
    )

    expect(sheets[0]?.rows).toHaveLength(1)
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('repeats a filled row and caps the total', () => {
    const { sheets, diagnostics } = readOds(
      odsWithBody(
        '<table:table table:name="T">' +
          `<table:table-row table:number-rows-repeated="100000">${cell('A')}</table:table-row>` +
          '</table:table>'
      )
    )

    expect(sheets[0]?.rows).toHaveLength(MAX_ROWS)
    expect(diagnostics.map((d) => d.code)).toContain('sheet-too-large')
  })

  it('caps a runaway column repeat', () => {
    const { sheets, diagnostics } = readOds(
      odsWithBody(
        '<table:table table:name="T"><table:table-row>' +
          '<table:table-cell office:value-type="string" table:number-columns-repeated="20000">' +
          '<text:p>x</text:p></table:table-cell>' +
          '</table:table-row></table:table>'
      )
    )

    expect(sheets[0]?.rows[0]).toHaveLength(MAX_COLS)
    expect(diagnostics.map((d) => d.code)).toContain('sheet-too-large')
  })
})

describe('readOds structural edge cases', () => {
  it('counts covered cells so columns after a merge do not shift', () => {
    const { sheets } = readOds(
      odsWithBody(
        '<table:table table:name="T"><table:table-row>' +
          '<table:table-cell table:number-columns-spanned="2" table:number-rows-spanned="1" ' +
          'office:value-type="string"><text:p>Titel</text:p></table:table-cell>' +
          '<table:covered-table-cell/>' +
          cell('danach') +
          '</table:table-row></table:table>'
      )
    )

    expect(sheets[0]?.rows[0]?.map((c) => c.text)).toEqual(['Titel', '', 'danach'])
  })

  it('finds rows wrapped in header-rows and row-group containers', () => {
    // Legal ODF that a child-node walk would miss entirely.
    const { sheets } = readOds(
      odsWithBody(
        '<table:table table:name="T">' +
          `<table:table-header-rows><table:table-row>${cell('Kopf')}</table:table-row></table:table-header-rows>` +
          `<table:table-row-group><table:table-row>${cell('Daten')}</table:table-row></table:table-row-group>` +
          '</table:table>'
      )
    )

    expect(sheets[0]?.rows.map((row) => row[0]?.text)).toEqual(['Kopf', 'Daten'])
  })

  it('drops trailing blank rows but keeps gaps between data', () => {
    const { sheets } = readOds(
      odsWithBody(
        '<table:table table:name="T">' +
          `<table:table-row>${cell('A')}</table:table-row>` +
          '<table:table-row><table:table-cell/></table:table-row>' +
          `<table:table-row>${cell('B')}</table:table-row>` +
          '<table:table-row><table:table-cell/></table:table-row>' +
          '</table:table>'
      )
    )

    expect(sheets[0]?.rows.map((row) => row[0]?.text ?? null)).toEqual(['A', null, 'B'])
  })

  it('reports an empty sheet without choking on it', () => {
    const { sheets } = readOds(
      odsWithBody(
        '<table:table table:name="Leer"><table:table-row table:number-rows-repeated="1048576"/></table:table>'
      )
    )

    expect(sheets[0]?.name).toBe('Leer')
    expect(sheets[0]?.rows).toEqual([])
  })
})

describe('readOds failure handling', () => {
  it('reports broken XML instead of throwing', () => {
    // DOMParser returns a <parsererror> document rather than raising.
    const { sheets, diagnostics } = readOds(zipSync({ 'content.xml': strToU8('<office:body><unclosed>') }))

    expect(sheets).toEqual([])
    expect(diagnostics[0]?.severity).toBe('error')
    expect(diagnostics[0]?.message).toContain('beschädigt')
  })

  it('reports a zip without content.xml', () => {
    const { diagnostics } = readOds(zipSync({ 'other.txt': strToU8('hallo') }))

    expect(diagnostics[0]?.message).toContain('content.xml')
  })

  it('reports something that is not a zip at all', () => {
    const { diagnostics } = readOds(strToU8('Das ist kein ZIP.'))

    expect(diagnostics[0]?.message).toContain('entpackt')
  })
})
