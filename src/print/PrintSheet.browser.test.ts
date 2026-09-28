import { afterEach, describe, expect, it } from 'vitest'

import { DEFAULT_LABEL_STYLE, GRID_PRESETS, slotsPerSheet } from '@/print/geometry'
import { fillSheet } from '@/test/browser/examples'
import { printMedia, renderSheet, screenMedia } from '@/test/browser/harness'

import '@/assets/fonts.css'
import '@/print/label.css'
import '@/print/print.css'

/*
 * A full A4 sheet per division the shop can choose, photographed as the printer
 * sees it.
 *
 * Print media is the point: there the cut marks are a quarter millimetre rather
 * than the screen's pixel, the preview's shadow is gone and the sheet is the
 * hair under A4 that keeps drivers from adding a blank page. None of that is
 * visible on screen, and none of it is visible in jsdom at all.
 */

// The media setting belongs to the page, not to the test, so it has to be put
// back or every later test would be photographed through print.
afterEach(() => screenMedia())

describe.each(GRID_PRESETS)('a sheet of $label', ({ grid, note }) => {
  it(`fills every slot and marks every cut (${note})`, async () => {
    const style = { ...DEFAULT_LABEL_STYLE, ...grid }
    const { locator, screen } = await renderSheet(fillSheet(slotsPerSheet(style)), { style })

    // Every slot filled, and one cut mark per inner division -- no border
    // around the sheet, because that edge is the edge of the paper.
    expect(screen.container.querySelectorAll('.label')).toHaveLength(grid.columns * grid.rows)
    expect(screen.container.querySelectorAll('.sheet__cut')).toHaveLength(grid.columns - 1 + (grid.rows - 1))

    await printMedia()
    await expect.element(locator).toMatchScreenshot(`sheet-${grid.columns}x${grid.rows}`)
  })
})

describe('a sheet that is not simply full', () => {
  it('leaves the slots that were already cut out of it free', async () => {
    // A part-used sheet can be missing any combination, not a run from the top
    // left: here the first and the last quarter are gone.
    const blocked = [0, 3]
    const { locator, screen } = await renderSheet(fillSheet(4), { blocked })

    expect(screen.container.querySelectorAll('.sheet__slot--blocked')).toHaveLength(blocked.length)

    await printMedia()
    await expect.element(locator).toMatchScreenshot('sheet-part-used')
  })

  it('prints the ruler when the shop wants to check the scale', async () => {
    const { locator } = await renderSheet(fillSheet(4), { showRuler: true })

    await printMedia()
    await expect.element(locator).toMatchScreenshot('sheet-with-ruler')
  })
})

describe('the same sheet on screen and on paper', () => {
  it('shows the seller a shadow and a pixel-wide cut, and prints neither', async () => {
    const { locator } = await renderSheet(fillSheet(4))

    // The preview: a drop shadow, and cut marks thickened to a whole pixel so
    // they do not vanish on a screen.
    await expect.element(locator).toMatchScreenshot('sheet-on-screen')

    await printMedia()
    await expect.element(locator).toMatchScreenshot('sheet-on-paper')
  })
})
