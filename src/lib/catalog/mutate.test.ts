import { describe, expect, it } from 'vitest'

import {
  attachPart,
  clearOverride,
  detachPart,
  removePart,
  removeProduct,
  reorderProducts,
  updateAttachment,
  upsertPart,
  upsertProduct
} from '@/lib/catalog/mutate'
import { partUsage, resolveLabels } from '@/lib/catalog/resolve'
import type { Catalog, Part, Product } from '@/lib/catalog/types'

const part = (id: string, over: Partial<Part> = {}): Part => ({
  id,
  name: `Teil ${id}`,
  artNr: null,
  priceCents: 10_000,
  priceText: null,
  ...over
})

const product = (id: string, over: Partial<Product> = {}): Product => ({
  id,
  name: `Produkt ${id}`,
  subtitle: null,
  artNr: null,
  priceCents: 50_000,
  priceNote: null,
  note: null,
  copies: 1,
  preselected: true,
  layout: null,
  parts: [],
  sortIndex: 0,
  ...over
})

const base: Catalog = {
  parts: [part('t1'), part('t2')],
  products: [
    product('p1', {
      sortIndex: 0,
      parts: [{ partId: 't1', exhibited: true, priceCentsOverride: null, priceTextOverride: null }]
    }),
    product('p2', {
      sortIndex: 1,
      parts: [{ partId: 't1', exhibited: false, priceCentsOverride: null, priceTextOverride: null }]
    })
  ]
}

describe('products', () => {
  it('adds a new one and updates an existing one in place', () => {
    const added = upsertProduct(base, product('p3'))
    expect(added.products).toHaveLength(3)

    const renamed = upsertProduct(added, { ...product('p1'), name: 'Neuer Name' })
    expect(renamed.products).toHaveLength(3)
    expect(renamed.products[0]?.name).toBe('Neuer Name')
  })

  it('keeps the order when updating', () => {
    const changed = upsertProduct(base, { ...base.products[0]!, name: 'X' })

    expect(changed.products.map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('removes one without touching the parts catalogue', () => {
    const removed = removeProduct(base, 'p1')

    expect(removed.products.map((p) => p.id)).toEqual(['p2'])
    expect(removed.parts).toHaveLength(2)
  })
})

describe('parts', () => {
  it('adds and updates by id', () => {
    const added = upsertPart(base, part('t3'))
    expect(added.parts).toHaveLength(3)

    const repriced = upsertPart(added, { ...part('t1'), priceCents: 12_000 })
    expect(repriced.parts).toHaveLength(3)
    expect(repriced.parts[0]?.priceCents).toBe(12_000)
  })

  it('a price change reaches every product at once', () => {
    // The whole point of a shared catalogue.
    const repriced = upsertPart(base, { ...part('t1'), priceCents: 13_000 })
    const labels = resolveLabels(repriced)

    expect(labels.map((label) => label.extras[0]?.priceCents)).toEqual([13_000, 13_000])
  })

  it('deleting a part detaches it everywhere', () => {
    // Left behind, the attachment would resolve to nothing and the row would
    // vanish from the label with no explanation.
    const removed = removePart(base, 't1')

    expect(removed.parts.map((p) => p.id)).toEqual(['t2'])
    expect(removed.products.flatMap((p) => p.parts)).toEqual([])
  })

  it('counts how many products use each part', () => {
    expect(partUsage(base).get('t1')).toBe(2)
    expect(partUsage(base).get('t2')).toBeUndefined()
  })
})

describe('attachments', () => {
  it('attaches a part to a product', () => {
    const attached = attachPart(base, 'p2', 't2', { exhibited: true })

    expect(attached.products[1]?.parts.map((link) => link.partId)).toEqual(['t1', 't2'])
    expect(attached.products[1]?.parts[1]?.exhibited).toBe(true)
  })

  it('refuses to attach the same part twice', () => {
    // Otherwise it would print twice and be counted twice in the total.
    const twice = attachPart(attachPart(base, 'p2', 't2'), 'p2', 't2')

    expect(twice.products[1]?.parts).toHaveLength(2)
  })

  it('detaches without deleting the part', () => {
    const detached = detachPart(base, 'p1', 't1')

    expect(detached.products[0]?.parts).toEqual([])
    expect(detached.parts).toHaveLength(2)
  })

  it('overrides the price for one product only', () => {
    const overridden = updateAttachment(base, 'p2', 't1', { priceCentsOverride: 14_900 })
    const labels = resolveLabels(overridden)

    expect(labels[0]?.extras[0]?.priceCents).toBe(10_000)
    expect(labels[1]?.extras[0]?.priceCents).toBe(14_900)
  })

  it('goes back to the catalogue price when the override is cleared', () => {
    const overridden = updateAttachment(base, 'p2', 't1', { priceCentsOverride: 14_900 })
    const cleared = clearOverride(overridden, 'p2', 't1')

    expect(resolveLabels(cleared)[1]?.extras[0]?.priceCents).toBe(10_000)
  })

  it('lets one product show a free text where the catalogue has a number', () => {
    const overridden = updateAttachment(base, 'p2', 't1', { priceTextOverride: 'auf Anfrage' })
    const labels = resolveLabels(overridden)

    expect(labels[1]?.extras[0]?.priceText).toBe('auf Anfrage')
    expect(labels[1]?.extras[0]?.priceCents).toBeNull()
  })
})

describe('ordering', () => {
  it('renumbers to the given order', () => {
    const reordered = reorderProducts(base, ['p2', 'p1'])

    expect(reordered.products.map((p) => [p.id, p.sortIndex])).toEqual([
      ['p2', 0],
      ['p1', 1]
    ])
  })

  it('puts unlisted products after the listed ones, keeping their relative order', () => {
    const extended = upsertProduct(base, product('p3', { sortIndex: 2 }))
    const reordered = reorderProducts(extended, ['p3'])

    expect(reordered.products.map((p) => p.id)).toEqual(['p3', 'p1', 'p2'])
  })
})
