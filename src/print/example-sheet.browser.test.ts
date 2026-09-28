import { afterEach, describe, expect, it } from 'vitest'

import { catalogFromLabels } from '@/lib/catalog/import'
import { resolveLabels } from '@/lib/catalog/resolve'
import { readOds } from '@/lib/ods/read-ods'
import { buildLabels } from '@/lib/schema/build-labels'
import { DEFAULT_LABEL_STYLE, slotsPerSheet } from '@/print/geometry'
import { printMedia, renderSheet, screenMedia } from '@/test/browser/harness'

import EXAMPLE_ODS_URL from '../../beispiele/preisschilder-beispiel.ods'

import '@/assets/fonts.css'
import '@/print/label.css'
import '@/print/print.css'

/*
 * The example spreadsheet, printed.
 *
 * Every other suite prints labels written for a test. This one takes the file
 * the shop actually downloads from the start page, runs it through the whole
 * import -- read the .ods, build the labels, fold the repeated add-on rows into
 * parts, resolve them back into labels -- and photographs the result. If any
 * step of that chain quietly changes what a row means, the sheet shows it.
 */

afterEach(() => screenMedia())

async function exampleLabels() {
  const bytes = new Uint8Array(await (await fetch(EXAMPLE_ODS_URL)).arrayBuffer())
  const { sheets, diagnostics: readDiagnostics } = readOds(bytes)
  const { labels, diagnostics } = buildLabels(sheets)
  // Through the catalogue and back, the way an import leaves the data: repeated
  // add-on rows folded into shared parts, differing prices kept as overrides.
  return { labels: resolveLabels(catalogFromLabels(labels).catalog), diagnostics: [...readDiagnostics, ...diagnostics] }
}

describe('the example spreadsheet', () => {
  it('reads without complaint and prints as its screenshot says', async () => {
    const { labels, diagnostics } = await exampleLabels()

    expect(diagnostics).toEqual([])
    expect(labels.length).toBeGreaterThan(3)
    expect(labels.map((label) => label.name)).toMatchSnapshot('what the example sheet holds')

    const { locator } = await renderSheet(labels.slice(0, slotsPerSheet(DEFAULT_LABEL_STYLE)), {
      brand: 'Holzkunst Seiffen'
    })
    await printMedia()
    await expect.element(locator).toMatchScreenshot('example-sheet')
  })

  it('carries its exhibition prices onto the paper', async () => {
    const { labels } = await exampleLabels()
    const exhibited = labels.filter((label) => label.extras.some((extra) => extra.exhibited))

    expect(exhibited.length).toBeGreaterThan(0)

    const { locator, screen } = await renderSheet(exhibited.slice(0, 4))
    expect(screen.container.querySelectorAll('.label__breakdown').length).toBeGreaterThan(0)

    await printMedia()
    await expect.element(locator).toMatchScreenshot('example-sheet-exhibited')
  })
})
