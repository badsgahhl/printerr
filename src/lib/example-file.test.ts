import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { readOds } from '@/lib/ods/read-ods'
import { computePriceView } from '@/lib/price'
import { buildLabels } from '@/lib/schema/build-labels'

/**
 * End-to-end over the files the shop actually gets: writer to zip to reader to
 * labels. The unit tests above each cover one link; this one covers the chain.
 *
 * Regenerate the fixtures with `pnpm beispiele`.
 */

function load(name: string) {
  // Vite rewrites import.meta.url to a served path, so it cannot locate files on
  // disk; vitest.config.ts pins `root` to the project, which makes cwd reliable.
  const path = join(process.cwd(), 'beispiele', name)
  const { sheets, diagnostics } = readOds(new Uint8Array(readFileSync(path)))
  expect(diagnostics).toEqual([])
  return buildLabels(sheets)
}

describe('preisschilder-beispiel.ods', () => {
  it('imports without a single complaint', () => {
    const { labels, diagnostics } = load('preisschilder-beispiel.ods')

    expect(diagnostics).toEqual([])
    expect(labels.map((label) => label.id)).toEqual(['R-01', 'E-01', 'S-01', 'N-01', 'M-01', 'P-01'])
  })

  it('carries the copy count and the preselection from the sheet', () => {
    const { labels } = load('preisschilder-beispiel.ods')
    const byId = new Map(labels.map((label) => [label.id, label]))

    expect(byId.get('E-01')?.copies).toBe(2)
    expect(byId.get('N-01')?.preselected).toBe(false)
    expect(byId.get('R-01')?.preselected).toBe(true)
  })

  it('prices the Mühle as it stands in the shop', () => {
    const { labels } = load('preisschilder-beispiel.ods')
    const view = computePriceView(labels.find((label) => label.id === 'M-01')!)

    expect(view.mode).toBe('exhibition')
    expect(view.mainCents).toBe(114_800)
    expect(view.breakdown.map((row) => row.label)).toEqual(['ohne Figuren', 'Bergmann', 'Engel', 'weitere Figuren'])
    expect(view.breakdown.at(-1)?.amountText).toBe('ab 90,00 €')
  })

  it('prices the Pyramide including its figures', () => {
    const { labels } = load('preisschilder-beispiel.ods')
    const view = computePriceView(labels.find((label) => label.id === 'P-01')!)

    expect(view.mainCents).toBe(149_400)
  })

  it('leaves a plain product plain', () => {
    const { labels } = load('preisschilder-beispiel.ods')
    const view = computePriceView(labels.find((label) => label.id === 'R-01')!)

    expect(view.mode).toBe('base')
    expect(view.mainCents).toBe(8900)
    expect(view.breakdown).toEqual([])
  })

  it('shows a non-exhibited add-on as information without changing the price', () => {
    const { labels } = load('preisschilder-beispiel.ods')
    const view = computePriceView(labels.find((label) => label.id === 'S-01')!)

    expect(view.mode).toBe('base')
    expect(view.mainCents).toBe(14_900)
    expect(view.breakdown[0]?.label).toBe('Ersatzkerzen')
  })

  it('totals six sheets worth of labels across the file', () => {
    const { labels } = load('preisschilder-beispiel.ods')
    const selected = labels.filter((label) => label.preselected)

    expect(selected.reduce((total, label) => total + label.copies, 0)).toBe(6)
  })
})

describe('preisschilder-vorlage.ods', () => {
  it('is a valid but empty starting point', () => {
    const { labels, diagnostics } = load('preisschilder-vorlage.ods')

    expect(labels).toEqual([])
    expect(diagnostics).toEqual([])
  })
})

describe('preisschilder-fehlerbeispiel.ods', () => {
  it('reports each planted mistake exactly once', () => {
    const { diagnostics } = load('preisschilder-fehlerbeispiel.ods')

    expect(diagnostics.map((diagnostic) => diagnostic.code).sort()).toEqual([
      'bad-price',
      'duplicate-id',
      'exhibited-without-price',
      'extra-without-price',
      'missing-id',
      'unknown-product'
    ])
  })

  it('points at the row the seller has to open', () => {
    const { diagnostics } = load('preisschilder-fehlerbeispiel.ods')
    const duplicate = diagnostics.find((diagnostic) => diagnostic.code === 'duplicate-id')

    expect(duplicate?.sheet).toBe('Produkte')
    expect(duplicate?.row).toBe(3)
    expect(duplicate?.message).toContain('Zeile 2')
  })

  it('still imports the labels that are fine', () => {
    const { labels } = load('preisschilder-fehlerbeispiel.ods')

    expect(labels.map((label) => label.id)).toEqual(['R-01', 'M-01'])
    // The Mühle has an exhibited figure with no price, so it is not preselected.
    expect(labels.find((label) => label.id === 'M-01')?.preselected).toBe(false)
  })
})
