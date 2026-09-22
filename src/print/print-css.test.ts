import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Two rules of the print stylesheet, guarded in code.
 *
 * Nothing else here renders a page, so these would otherwise only be checked by
 * a seller standing at the printer with the sheet already through it. Both have
 * been wrong before, and both fail silently: the cut lines simply are not there,
 * or every second page comes out blank.
 *
 * Read as text on purpose. jsdom applies no stylesheet and knows nothing about
 * paged media, so asking it would prove less than reading the file does.
 */
const css = readFileSync(join(process.cwd(), 'src/print/print.css'), 'utf8').replaceAll(/\/\*[\s\S]*?\*\//gu, '')

/** The declaration blocks whose selector matches, `@media` rules included. */
function declarationsFor(selector: RegExp): string[] {
  const blocks: string[] = []
  const rule = /([^{}]+)\{([^{}]*)\}/gu
  let match: RegExpExecArray | null
  while ((match = rule.exec(css)) !== null) {
    if (selector.test(match[1])) blocks.push(match[2])
  }
  return blocks
}

describe('the cut marks', () => {
  it('are drawn as borders and never as a background', () => {
    // A background colour is the first thing a browser leaves out of a printout,
    // and the seller has to find a different checkbox in every dialog to get it
    // back. Borders print either way.
    const blocks = declarationsFor(/\.sheet__cut/u)

    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks.join('\n')).toMatch(/border/u)
    for (const block of blocks) expect(block).not.toMatch(/background/u)
  })
})

describe('the page breaks', () => {
  it('are asked for before a sheet, never after one', () => {
    // A break after the last sheet also says something about the end of the
    // document, and Firefox answers that with an empty page.
    expect(css).toMatch(/break-before:\s*page/u)
    expect(css).not.toMatch(/break-after:\s*page/u)
  })
})
