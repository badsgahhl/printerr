import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { readOds } from '@/lib/ods/read-ods'
import { computePriceView } from '@/lib/price'
import { buildLabels } from '@/lib/schema/build-labels'
import type { Label } from '@/lib/types'

/**
 * The reader against a file LibreOffice actually wrote.
 *
 * Every other .ods test uses files this project generated, which only proves the
 * reader agrees with its own writer. This fixture came out of LibreOffice
 * 25.8.7.3: the generated example was opened, one add-on price edited from
 * 129,00 to 129,99, and saved. It therefore carries everything Calc adds --
 * settings.xml, a PNG thumbnail, manifest.rdf, the calcext namespace, and the
 * repeat counters that pad every sheet to the full grid.
 *
 * Regenerating it means repeating those steps by hand; it is not produced by
 * `pnpm beispiele`.
 */

const load = (name: string): Uint8Array => new Uint8Array(readFileSync(join(process.cwd(), 'src/test/fixtures', name)))

const read = (name: string) => {
  const { sheets, diagnostics } = readOds(load(name))
  return { sheets, readDiagnostics: diagnostics, ...buildLabels(sheets) }
}

/** Everything about a label except add-on prices, which is what was edited. */
const shapeOf = (label: Label) => ({
  id: label.id,
  name: label.name,
  subtitle: label.subtitle,
  artNr: label.artNr,
  priceCents: label.priceCents,
  priceNote: label.priceNote,
  copies: label.copies,
  preselected: label.preselected,
  extras: label.extras.map((extra) => [extra.name, extra.artNr, extra.exhibited])
})

describe('a file written by LibreOffice', () => {
  it('reads without a single complaint', () => {
    const { readDiagnostics, diagnostics } = read('libreoffice-roundtrip.ods')

    expect(readDiagnostics).toEqual([])
    expect(diagnostics).toEqual([])
  })

  it('finds both sheets, umlaut and all', () => {
    const { sheets } = read('libreoffice-roundtrip.ods')

    expect(sheets.map((sheet) => sheet.name)).toEqual(['Produkte', 'Zusätze'])
  })

  it('trims the million-row padding Calc writes at the end of every sheet', () => {
    // Left in, this would be over a million rows per sheet.
    const { sheets } = read('libreoffice-roundtrip.ods')

    expect(sheets.map((sheet) => sheet.rows.length)).toEqual([7, 7])
  })

  it('survives the extra files Calc puts in the archive', () => {
    // settings.xml, Thumbnails/thumbnail.png, manifest.rdf, Configurations2/ --
    // only content.xml is decompressed, so none of them may get in the way.
    const { labels } = read('libreoffice-roundtrip.ods')

    expect(labels).toHaveLength(6)
  })

  it('keeps umlauts and typographic characters intact', () => {
    const { labels } = read('libreoffice-roundtrip.ods')
    const byId = new Map(labels.map((label) => [label.id, label]))

    expect(byId.get('E-01')?.subtitle).toBe('Wendt & Kühn · Ahorn')
    expect(byId.get('N-01')?.subtitle).toBe('Richard Glässer · 40 cm')
    expect(byId.get('S-01')?.name).toBe('Schwibbogen „Bergparade"')
  })

  it('reads the price that was edited in Calc', () => {
    // The whole point of this fixture: a value Calc wrote, not one we did.
    const { labels } = read('libreoffice-roundtrip.ods')
    const mill = labels.find((label) => label.id === 'M-01')

    expect(mill?.extras.map((extra) => extra.priceCents)).toEqual([12_999, 12_900, null])
    expect(computePriceView(mill!).mainCents).toBe(114_899)
  })

  it('carries the yes/no and count columns through a round trip', () => {
    const { labels } = read('libreoffice-roundtrip.ods')
    const byId = new Map(labels.map((label) => [label.id, label]))

    expect(byId.get('E-01')?.copies).toBe(2)
    expect(byId.get('N-01')?.preselected).toBe(false)
    expect(byId.get('M-01')?.extras.map((extra) => extra.exhibited)).toEqual([true, true, false])
  })
})

describe('LibreOffice output against our own', () => {
  it('produces the same labels as the file we generated', () => {
    // A round trip through Calc must not change the shape of anything -- only
    // the one price that was deliberately edited.
    const fromCalc = read('libreoffice-roundtrip.ods')
    const { sheets } = readOds(
      new Uint8Array(readFileSync(join(process.cwd(), 'beispiele/preisschilder-beispiel.ods')))
    )
    const generated = buildLabels(sheets)

    expect(fromCalc.labels.map((label) => shapeOf(label))).toEqual(generated.labels.map((label) => shapeOf(label)))
  })

  it('differs only in the edited add-on price', () => {
    const fromCalc = read('libreoffice-roundtrip.ods')
    const { sheets } = readOds(
      new Uint8Array(readFileSync(join(process.cwd(), 'beispiele/preisschilder-beispiel.ods')))
    )
    const generated = buildLabels(sheets)

    const pricesOf = (labels: readonly Label[]) =>
      labels.flatMap((label) => label.extras.map((extra) => extra.priceCents))

    // Label order follows the sheet: S-01's spare candles come before M-01.
    expect(pricesOf(generated.labels)).toEqual([490, 12_900, 12_900, null, 18_000, 2400])
    expect(pricesOf(fromCalc.labels)).toEqual([490, 12_999, 12_900, null, 18_000, 2400])
  })
})
