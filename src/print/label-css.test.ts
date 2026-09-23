import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { BREAKDOWN_LINE_HEIGHT, BREAKDOWN_MAX_LINES } from '@/print/geometry'

/**
 * The one number label.css and geometry.ts both have to know.
 *
 * The geometry sizes a wrapped add-on row by the line height of its description,
 * and the stylesheet sets that line height; if they drifted apart, every second
 * line would either be cut off or float in empty space. Read as text, like
 * print-css.test.ts, because jsdom applies no stylesheet.
 */
const css = readFileSync(join(process.cwd(), 'src/print/label.css'), 'utf8').replaceAll(/\/\*[\s\S]*?\*\//gu, '')
const description = /\.label__row-label\s*\{([^}]*)\}/u.exec(css)?.[1] ?? ''

describe('an add-on description in the stylesheet', () => {
  it('wraps at the line height its row is sized for', () => {
    expect(/line-height:\s*([\d.]+)/u.exec(description)?.[1]).toBe(String(BREAKDOWN_LINE_HEIGHT))
  })

  it('is clamped to the lines the geometry allows', () => {
    expect(/-webkit-line-clamp:\s*(\d+)/u.exec(description)?.[1]).toBe(String(BREAKDOWN_MAX_LINES))
  })
})
