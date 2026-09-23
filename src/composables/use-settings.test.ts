import { describe, expect, it } from 'vitest'

import { createSettings, normalizeStyle } from '@/composables/use-settings'
import { createSafeStorage, type StorageLike } from '@/infra/safe-storage'
import { DEFAULT_LABEL_STYLE, STYLE_LIMITS } from '@/print/geometry'

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key)
  }
}

const fresh = (backing = memoryStorage()) => createSettings({ storage: createSafeStorage(() => backing) })

/** What an older version wrote for an untouched style. */
const legacyDefaults = () => ({ columns: 2, rows: 2, paddingMm: 9, nameMaxPx: 34, priceMaxPx: 72, detailMaxPx: 12 })

const LEGACY_KEYS = [
  'subtitleMaxPx',
  'artNrMaxPx',
  'priceSuffixMaxPx',
  'breakdownMaxPx',
  'noteMaxPx',
  'brandMaxPx'
] as const

describe('shop branding', () => {
  it('prints nothing until it is switched on and filled in', () => {
    const settings = fresh()
    expect(settings.brand()).toBeNull()

    settings.state.brandText = 'Holzkunst Musterladen'
    expect(settings.brand()).toBeNull()

    settings.state.brandEnabled = true
    expect(settings.brand()).toBe('Holzkunst Musterladen')
  })

  it('treats whitespace as empty', () => {
    const settings = fresh()
    settings.state.brandEnabled = true
    settings.state.brandText = '   '

    expect(settings.brand()).toBeNull()
  })
})

describe('label style settings', () => {
  it('starts at the defaults', () => {
    const settings = fresh()

    expect(settings.state.labelStyle).toEqual(DEFAULT_LABEL_STYLE)
    expect(settings.isStyleDefault()).toBe(true)
  })

  it('accepts a change and notices it is no longer default', () => {
    const settings = fresh()
    settings.setStyle('priceMaxPx', 90)

    expect(settings.state.labelStyle.priceMaxPx).toBe(90)
    expect(settings.isStyleDefault()).toBe(false)
  })

  it('leaves the other sizes alone', () => {
    const settings = fresh()
    settings.setStyle('priceMaxPx', 90)

    expect(settings.state.labelStyle.nameMaxPx).toBe(DEFAULT_LABEL_STYLE.nameMaxPx)
    expect(settings.state.labelStyle.paddingMm).toBe(DEFAULT_LABEL_STYLE.paddingMm)
  })

  it('clamps a value outside its limits rather than accepting it', () => {
    // A slider cannot produce these, but a stale stored value or a typed-in
    // number can, and an unreadable label is worse than a rejected setting.
    const settings = fresh()
    settings.setStyle('priceMaxPx', 10_000)
    expect(settings.state.labelStyle.priceMaxPx).toBe(STYLE_LIMITS.priceMaxPx.max)

    settings.setStyle('paddingMm', -5)
    expect(settings.state.labelStyle.paddingMm).toBe(STYLE_LIMITS.paddingMm.min)
  })

  it('switches the sheet grid without touching the sizes', () => {
    const settings = fresh()
    settings.setStyle('priceMaxPx', 90)
    settings.setGrid({ columns: 3, rows: 3 })

    expect(settings.state.labelStyle.columns).toBe(3)
    expect(settings.state.labelStyle.rows).toBe(3)
    expect(settings.state.labelStyle.priceMaxPx).toBe(90)
  })

  it('keeps the grid whole and within range', () => {
    const settings = fresh()
    settings.setGrid({ columns: 2.7, rows: 99 })

    expect(settings.state.labelStyle.columns).toBe(3)
    expect(settings.state.labelStyle.rows).toBe(STYLE_LIMITS.rows.max)
  })

  it('changes one text size without touching the others', () => {
    const settings = fresh()
    settings.setStyle('noteMaxPx', 28)

    expect(settings.state.labelStyle).toEqual({ ...DEFAULT_LABEL_STYLE, noteMaxPx: 28 })
  })

  it('resets only the settings it is told to', () => {
    const settings = fresh()
    settings.setStyle('noteMaxPx', 28)
    settings.setStyle('priceMaxPx', 90)
    settings.setGrid({ columns: 3, rows: 3 })

    settings.resetStyle(['noteMaxPx'])

    expect(settings.state.labelStyle.noteMaxPx).toBe(DEFAULT_LABEL_STYLE.noteMaxPx)
    expect(settings.state.labelStyle.priceMaxPx).toBe(90)
    expect(settings.state.labelStyle.columns).toBe(3)
    expect(settings.isStyleDefault(['noteMaxPx'])).toBe(true)
    expect(settings.isStyleDefault(['noteMaxPx', 'priceMaxPx'])).toBe(false)
    expect(settings.isStyleDefault()).toBe(false)
  })

  it('goes back to the defaults on reset', () => {
    const settings = fresh()
    settings.setStyle('priceMaxPx', 90)
    settings.setStyle('paddingMm', 12)
    settings.resetStyle()

    expect(settings.state.labelStyle).toEqual(DEFAULT_LABEL_STYLE)
    expect(settings.isStyleDefault()).toBe(true)
  })

  it('survives a reload', async () => {
    const backing = memoryStorage()
    const first = fresh(backing)
    first.setStyle('nameMaxPx', 40)
    first.state.brandEnabled = true
    first.state.brandText = 'Krawtschenko GmbH'

    await new Promise((resolve) => setTimeout(resolve, 0))

    const second = fresh(backing)
    expect(second.state.labelStyle.nameMaxPx).toBe(40)
    expect(second.brand()).toBe('Krawtschenko GmbH')
  })
})

describe('normalizeStyle', () => {
  it('fills in anything that is missing', () => {
    expect(normalizeStyle({ priceMaxPx: 80 })).toEqual({ ...DEFAULT_LABEL_STYLE, priceMaxPx: 80 })
    expect(normalizeStyle(undefined)).toEqual(DEFAULT_LABEL_STYLE)
  })

  it('repairs a stored grid that is not whole numbers', () => {
    const style = normalizeStyle({ columns: 2.4, rows: 0 })

    expect(style.columns).toBe(2)
    expect(style.rows).toBe(STYLE_LIMITS.rows.min)
  })

  it('pulls stored values back into range', () => {
    const style = normalizeStyle({ priceMaxPx: 500, paddingMm: 0, noteMaxPx: 2 })

    expect(style.priceMaxPx).toBe(STYLE_LIMITS.priceMaxPx.max)
    expect(style.paddingMm).toBe(STYLE_LIMITS.paddingMm.min)
    expect(style.noteMaxPx).toBe(STYLE_LIMITS.noteMaxPx.min)
  })

  it('carries the old shared small-text size over to every small text', () => {
    // Before each text had its own size there was one for all of them; someone
    // who had turned it up should not find it quietly reset.
    const style = normalizeStyle({ detailMaxPx: 18 })

    expect(style.subtitleMaxPx).toBe(22.5)
    expect(style.artNrMaxPx).toBe(18)
    expect(style.breakdownMaxPx).toBe(18)
    expect(style.noteMaxPx).toBe(16.5)
    expect(style.brandMaxPx).toBe(19.5)
    expect(style.nameMaxPx).toBe(DEFAULT_LABEL_STYLE.nameMaxPx)
    expect(style.priceMaxPx).toBe(DEFAULT_LABEL_STYLE.priceMaxPx)
    expect(style).not.toHaveProperty('detailMaxPx')
  })

  it('lands carried-over sizes on a notch of their slider', () => {
    const style = normalizeStyle({ detailMaxPx: 13.5 })

    const offStep = LEGACY_KEYS.filter((key) => (style[key] / STYLE_LIMITS[key].step) % 1 !== 0)
    expect(offStep).toEqual([])
  })

  it('reads the old default as the new defaults', () => {
    expect(normalizeStyle({ detailMaxPx: 12 })).toEqual(DEFAULT_LABEL_STYLE)
  })

  it('prefers a size of its own over the old shared one', () => {
    const style = normalizeStyle({ detailMaxPx: 18, noteMaxPx: 30 })

    expect(style.noteMaxPx).toBe(30)
    expect(style.artNrMaxPx).toBe(18)
  })

  it('ignores an old shared size that is not a number', () => {
    const style = normalizeStyle({ detailMaxPx: 'groß' })

    expect(style).toEqual(DEFAULT_LABEL_STYLE)
  })

  it('falls back to the default for values that are not numbers at all', () => {
    // Storage is shared across every local HTML file in Chrome, so what comes
    // back is not guaranteed to be what this app wrote.
    const style = normalizeStyle({
      priceMaxPx: Number.NaN,
      nameMaxPx: 'groß' as unknown as number,
      paddingMm: Number.POSITIVE_INFINITY
    })

    expect(style.priceMaxPx).toBe(DEFAULT_LABEL_STYLE.priceMaxPx)
    expect(style.nameMaxPx).toBe(DEFAULT_LABEL_STYLE.nameMaxPx)
    expect(style.paddingMm).toBe(DEFAULT_LABEL_STYLE.paddingMm)
  })

  it('keeps a small-text size set before the sizes were split', () => {
    const backing = memoryStorage()
    backing.setItem('printerr:v1:settings', JSON.stringify({ labelStyle: { ...legacyDefaults(), detailMaxPx: 16 } }))

    const settings = fresh(backing)
    expect(settings.state.labelStyle.artNrMaxPx).toBe(16)
    expect(settings.state.labelStyle.breakdownMaxPx).toBe(16)
  })

  it('repairs a stored style that is out of range on load', async () => {
    const backing = memoryStorage()
    backing.setItem(
      'printerr:v1:settings',
      JSON.stringify({ labelStyle: { priceMaxPx: 9999, nameMaxPx: 34, priceMaxPxTypo: 1 } })
    )

    const settings = fresh(backing)
    expect(settings.state.labelStyle.priceMaxPx).toBe(STYLE_LIMITS.priceMaxPx.max)
  })
})
