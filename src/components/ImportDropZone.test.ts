import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ImportDropZone from '@/components/ImportDropZone.vue'
import { readOds } from '@/lib/ods/read-ods'
import { buildLabels } from '@/lib/schema/build-labels'

const downloadLink = (): HTMLAnchorElement =>
  screen.getByRole('link', { name: /Beispieltabelle/u }) as HTMLAnchorElement

/**
 * Fetch whatever the link points at.
 *
 * Vite resolves the sheet import to a served path during development and tests,
 * and to a base64 data URL in the build, where it falls under the inline limit.
 * Both have to lead to the same readable file, which is the point of the import:
 * a hand-written path would silently rot.
 */
function linkedBytes(href: string): Uint8Array {
  if (href.startsWith('data:')) {
    const base64 = href.slice(href.indexOf(',') + 1)
    return Uint8Array.from(atob(base64), (character) => character.codePointAt(0)!)
  }
  return new Uint8Array(readFileSync(join(process.cwd(), href.replace(/^\//u, ''))))
}

describe('ImportDropZone', () => {
  it('offers the example sheet under the name the shop expects', () => {
    render(ImportDropZone)

    expect(downloadLink()).toHaveAttribute('download', 'preisschilder-beispiel.ods')
  })

  it('links to something rather than nowhere', () => {
    render(ImportDropZone)

    expect(downloadLink().getAttribute('href')).toBeTruthy()
  })

  it('hands out a file the importer reads without a complaint', () => {
    render(ImportDropZone)

    const read = readOds(linkedBytes(downloadLink().getAttribute('href') ?? ''))
    const built = buildLabels(read.sheets)

    expect([...read.diagnostics, ...built.diagnostics]).toEqual([])
    expect(built.labels.map((label) => label.id)).toEqual(['R-01', 'E-01', 'S-01', 'N-01', 'M-01', 'P-01'])
  })
})
