import type { Catalog, Part, Product, ProductPart } from '@/lib/catalog/types'
import type { Label, LabelExtra } from '@/lib/types'

/**
 * Joining the stored catalogue back into the flat labels the printer works with.
 *
 * Everything downstream -- price view, fitting, pagination, PriceLabel -- keeps
 * working on Label and knows nothing about parts or overrides.
 */

export const partsById = (parts: readonly Part[]): ReadonlyMap<string, Part> =>
  new Map(parts.map((part) => [part.id, part]))

/** True when this attachment charges something other than the catalogue price. */
export function hasOverride(link: ProductPart): boolean {
  return link.priceCentsOverride !== null || link.priceTextOverride !== null
}

/**
 * The price this attachment actually charges.
 *
 * An override wins outright, including a text override that replaces a numeric
 * catalogue price -- "ab 90,00 €" instead of 129,00 € is a legitimate thing to
 * want for one product without touching the part everywhere else.
 */
export function effectivePrice(link: ProductPart, part: Part): { priceCents: number | null; priceText: string | null } {
  if (link.priceCentsOverride !== null) return { priceCents: link.priceCentsOverride, priceText: null }
  if (link.priceTextOverride !== null) return { priceCents: null, priceText: link.priceTextOverride }
  return { priceCents: part.priceCents, priceText: part.priceText }
}

function toExtra(link: ProductPart, part: Part): LabelExtra {
  const { priceCents, priceText } = effectivePrice(link, part)
  return {
    name: part.name,
    artNr: part.artNr,
    priceCents,
    priceText,
    exhibited: link.exhibited
  }
}

/**
 * Build the printable label for one product.
 *
 * Attachments pointing at a part that no longer exists are dropped rather than
 * rendered blank; `danglingParts` reports them so the editor can say so.
 */
export function resolveLabel(product: Product, parts: ReadonlyMap<string, Part>): Label {
  const extras: LabelExtra[] = []
  for (const link of product.parts) {
    const part = parts.get(link.partId)
    if (part) extras.push(toExtra(link, part))
  }

  return {
    id: product.id,
    name: product.name,
    subtitle: product.subtitle,
    artNr: product.artNr,
    priceCents: product.priceCents,
    priceNote: product.priceNote,
    note: product.note,
    copies: product.copies,
    preselected: product.preselected,
    layout: product.layout,
    extras,
    sourceRow: product.sortIndex + 1
  }
}

/** Every label, in the shop's own order. */
export function resolveLabels(catalog: Catalog): Label[] {
  const parts = partsById(catalog.parts)
  return [...catalog.products]
    .sort((left, right) => left.sortIndex - right.sortIndex)
    .map((product) => resolveLabel(product, parts))
}

/** Attachments whose part has been deleted, per product. */
export function danglingParts(catalog: Catalog): { productId: string; partId: string }[] {
  const known = new Set(catalog.parts.map((part) => part.id))
  return catalog.products.flatMap((product) =>
    product.parts
      .filter((link) => !known.has(link.partId))
      .map((link) => ({ productId: product.id, partId: link.partId }))
  )
}

/** How many products use each part, for the catalogue view and delete warnings. */
export function partUsage(catalog: Catalog): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  for (const product of catalog.products) {
    for (const link of product.parts) {
      counts.set(link.partId, (counts.get(link.partId) ?? 0) + 1)
    }
  }
  return counts
}
