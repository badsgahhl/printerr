import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ImportDropZone from '@/components/ImportDropZone.vue'
import { readOds } from '@/lib/ods/read-ods'
import { buildLabels } from '@/lib/schema/build-labels'

const downloadLink = (): HTMLAnchorElement =>
  screen.getByRole('link', { name: /Beispieltabelle/u }) as HTMLAnchorElement

describe('ImportDropZone', () => {
  it('offers the example sheet under the name the shop expects', () => {
    render(ImportDropZone)

    expect(downloadLink()).toHaveAttribute('download', 'preisschilder-beispiel.ods')
  })

  it('carries the sheet inside the page rather than linking to a second file', () => {
    // The shop copies nothing but index.html, and GitHub Pages renames emitted
    // assets on every build -- either way a separate file would download a 404.
    render(ImportDropZone)

    expect(downloadLink().getAttribute('href')).toMatch(/^data:[^,]*;base64,/u)
  })

  it('hands out a file the importer reads without a complaint', () => {
    render(ImportDropZone)
    const href = downloadLink().getAttribute('href') ?? ''
    const base64 = href.slice(href.indexOf(',') + 1)
    const bytes = Uint8Array.from(atob(base64), (character) => character.codePointAt(0)!)

    const read = readOds(bytes)
    const built = buildLabels(read.sheets)

    expect([...read.diagnostics, ...built.diagnostics]).toEqual([])
    expect(built.labels.map((label) => label.id)).toEqual(['R-01', 'E-01', 'S-01', 'N-01', 'M-01', 'P-01'])
  })
})
