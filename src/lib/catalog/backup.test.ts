import { describe, expect, it } from 'vitest'

import { backupFileName, parseBackup, toBackup } from '@/lib/catalog/backup'
import { catalogFromLabels } from '@/lib/catalog/import'
import { resolveLabels } from '@/lib/catalog/resolve'
import type { Catalog } from '@/lib/catalog/types'
import type { Label } from '@/lib/types'

const label = (id: string, over: Partial<Label> = {}): Label => ({
  id,
  name: `Produkt ${id}`,
  subtitle: 'Hersteller · Material',
  artNr: '1234',
  priceCents: 50_000,
  priceNote: null,
  note: null,
  copies: 1,
  preselected: true,
  layout: null,
  extras: [],
  sourceRow: 2,
  ...over
})

const sample: Catalog = catalogFromLabels([
  label('M-01', {
    priceNote: 'ohne Figuren',
    extras: [
      { name: 'Bergmann', artNr: '4712', priceCents: 12_900, priceText: null, exhibited: true },
      { name: 'weitere Figuren', artNr: null, priceCents: null, priceText: 'ab 90,00 €', exhibited: false }
    ]
  }),
  label('P-01', {
    extras: [{ name: 'Bergmann', artNr: '4712', priceCents: 13_900, priceText: null, exhibited: true }]
  })
]).catalog

const roundTrip = (catalog: Catalog): Catalog => {
  const result = parseBackup(JSON.stringify(toBackup(catalog)))
  if (!result.ok) throw new Error(result.error)
  return result.catalog
}

describe('backup round trip', () => {
  it('returns the catalogue unchanged', () => {
    expect(roundTrip(sample)).toEqual(sample)
  })

  it('preserves overrides, which are the easiest thing to lose', () => {
    const restored = roundTrip(sample)

    expect(resolveLabels(restored)).toEqual(resolveLabels(sample))
    expect(restored.products[1]?.parts[0]?.priceCentsOverride).toBe(13_900)
  })

  it('names the file by the day it was made', () => {
    expect(backupFileName(new Date('2026-09-21T10:00:00Z'))).toBe('preisschilder-sicherung-2026-09-21.json')
  })
})

describe('reading a backup', () => {
  it('rejects a file that is not JSON', () => {
    const result = parseBackup('nicht wirklich json')

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toContain('JSON')
  })

  it('rejects JSON that is not one of ours', () => {
    // Importing someone else's export as an empty catalogue would wipe the shop's
    // data without saying anything.
    const result = parseBackup(JSON.stringify({ hello: 'world' }))

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toContain('Preisschilder-Sicherung')
  })

  it('refuses a newer format rather than guessing', () => {
    const result = parseBackup(JSON.stringify({ ...toBackup(sample), version: 99 }))

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toContain('neueren Version')
  })

  it('fills in fields an older export might not have had', () => {
    const stripped = JSON.stringify({
      format: 'printerr-catalog',
      version: 1,
      catalog: { products: [{ id: 'p1', name: 'Engel' }], parts: [] }
    })
    const result = parseBackup(stripped)

    expect(result.ok).toBe(true)
    expect(result.ok && result.catalog.products[0]).toMatchObject({
      id: 'p1',
      name: 'Engel',
      copies: 1,
      preselected: true,
      priceCents: 0,
      parts: []
    })
  })

  it('drops entries too broken to mean anything', () => {
    const result = parseBackup(
      JSON.stringify({
        format: 'printerr-catalog',
        version: 1,
        catalog: { products: [{ name: 'ohne id' }, { id: 'p1', name: 'gut' }], parts: [{ id: 't1' }] }
      })
    )

    expect(result.ok && result.catalog.products.map((p) => p.id)).toEqual(['p1'])
    expect(result.ok && result.catalog.parts).toEqual([])
  })

  it('drops attachments whose part is missing from the file', () => {
    // Otherwise the product would carry an add-on that resolves to nothing.
    const result = parseBackup(
      JSON.stringify({
        format: 'printerr-catalog',
        version: 1,
        catalog: {
          products: [{ id: 'p1', name: 'Mühle', parts: [{ partId: 'gone' }, { partId: 't1' }] }],
          parts: [{ id: 't1', name: 'Bergmann' }]
        }
      })
    )

    expect(result.ok && result.catalog.products[0]?.parts.map((link) => link.partId)).toEqual(['t1'])
  })
})
