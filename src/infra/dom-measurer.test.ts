import { describe, expect, it } from 'vitest'

import { createDomMeasurer } from '@/infra/dom-measurer'

/**
 * Smoke tests only.
 *
 * jsdom has no layout engine, so every dimension it reports is zero -- the
 * numbers this returns can only be checked in a real browser. What is worth
 * asserting here is that the sandbox is built, used and cleaned up without
 * throwing, and that the search logic (tested properly in lib/fit-text.test.ts
 * against a model measurer) can call it safely.
 */

describe('createDomMeasurer', () => {
  it('adds a hidden sandbox to the document and takes it away again', () => {
    const measurer = createDomMeasurer()
    const host = document.querySelector('[data-printerr-measure]')

    expect(host).not.toBeNull()
    expect(host?.getAttribute('aria-hidden')).toBe('true')

    measurer.dispose()
    expect(document.querySelector('[data-printerr-measure]')).toBeNull()
  })

  it('keeps the sandbox off screen rather than hiding it outright', () => {
    // display:none would make every measurement zero even in a real browser.
    const measurer = createDomMeasurer()
    const host = document.querySelector<HTMLElement>('[data-printerr-measure]')

    expect(host?.style.visibility).toBe('hidden')
    expect(host?.style.display).not.toBe('none')
    expect(host?.style.contain).toBe('strict')

    measurer.dispose()
  })

  it('measures without throwing, for both wrapping modes', () => {
    const measurer = createDomMeasurer()

    const single = measurer.measure({
      text: '1.148,00 €',
      fontSizePx: 42,
      maxWidthPx: Number.POSITIVE_INFINITY,
      wrap: 'nowrap',
      styleKey: 'price'
    })
    const wrapped = measurer.measure({
      text: 'Räuchermann Bergmann mit Laterne',
      fontSizePx: 24,
      maxWidthPx: 300,
      wrap: 'wrap',
      styleKey: 'name'
    })

    for (const measurement of [single, wrapped]) {
      expect(Number.isFinite(measurement.width)).toBe(true)
      expect(Number.isFinite(measurement.height)).toBe(true)
      expect(typeof measurement.overflowsWidth).toBe('boolean')
    }

    measurer.dispose()
  })

  it('lifts the line clamp, so a description can report every line it needs', () => {
    // The label clamps descriptions to two lines. Measured under that clamp, a
    // description needing three would come back as two and be cut off in print.
    const measurer = createDomMeasurer()
    measurer.measure({
      text: 'Komplettset (Stern + Außenbeleuchtung)',
      fontSizePx: 19,
      maxWidthPx: 177,
      wrap: 'wrap',
      styleKey: 'breakdownLabel'
    })

    const cell = document.querySelector<HTMLElement>('[data-printerr-measure] .label > div')
    expect(cell?.className).toBe('label__row-label')
    expect(cell?.style.getPropertyValue('-webkit-line-clamp')).toBe('none')

    measurer.dispose()
  })

  it('applies the requested font size and style class to the measured cell', () => {
    const measurer = createDomMeasurer()
    measurer.measure({
      text: 'Engel',
      fontSizePx: 17.5,
      maxWidthPx: 200,
      wrap: 'wrap',
      styleKey: 'name'
    })

    const cell = document.querySelector<HTMLElement>('[data-printerr-measure] .label > div')
    expect(cell?.style.fontSize).toBe('17.5px')
    expect(cell?.className).toBe('label__name')
    // The label classes fix a height; measuring has to undo that.
    expect(cell?.style.height).toBe('auto')

    measurer.dispose()
  })

  it('tolerates an unknown style key', () => {
    const measurer = createDomMeasurer()

    expect(() =>
      measurer.measure({
        text: 'x',
        fontSizePx: 12,
        maxWidthPx: 100,
        wrap: 'wrap',
        styleKey: 'not-a-real-key'
      })
    ).not.toThrow()

    measurer.dispose()
  })
})
