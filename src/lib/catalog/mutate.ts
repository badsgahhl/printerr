import type { Catalog, Part, Product, ProductPart } from '@/lib/catalog/types'

/**
 * Every change the editor can make, as a pure function from catalogue to
 * catalogue. Keeping them here rather than in the composable means the rules
 * that matter -- what happens to attachments when a part is deleted, how an
 * override is cleared -- are testable without mounting anything.
 */

const withProducts = (catalog: Catalog, products: readonly Product[]): Catalog => ({ ...catalog, products })
const withParts = (catalog: Catalog, parts: readonly Part[]): Catalog => ({ ...catalog, parts })

export function upsertProduct(catalog: Catalog, product: Product): Catalog {
  const index = catalog.products.findIndex((candidate) => candidate.id === product.id)
  if (index === -1) return withProducts(catalog, [...catalog.products, product])
  return withProducts(
    catalog,
    catalog.products.map((candidate, at) => (at === index ? product : candidate))
  )
}

export function removeProduct(catalog: Catalog, productId: string): Catalog {
  return withProducts(
    catalog,
    catalog.products.filter((product) => product.id !== productId)
  )
}

export function upsertPart(catalog: Catalog, part: Part): Catalog {
  const index = catalog.parts.findIndex((candidate) => candidate.id === part.id)
  if (index === -1) return withParts(catalog, [...catalog.parts, part])
  return withParts(
    catalog,
    catalog.parts.map((candidate, at) => (at === index ? part : candidate))
  )
}

/**
 * Delete a part and detach it everywhere.
 *
 * Leaving the attachments behind would give products an add-on that resolves to
 * nothing -- a row that silently disappears from the label with no way to see why.
 */
export function removePart(catalog: Catalog, partId: string): Catalog {
  return {
    parts: catalog.parts.filter((part) => part.id !== partId),
    products: catalog.products.map((product) =>
      product.parts.some((link) => link.partId === partId)
        ? { ...product, parts: product.parts.filter((link) => link.partId !== partId) }
        : product
    )
  }
}

const mapProduct = (catalog: Catalog, productId: string, change: (product: Product) => Product): Catalog =>
  withProducts(
    catalog,
    catalog.products.map((product) => (product.id === productId ? change(product) : product))
  )

export function attachPart(
  catalog: Catalog,
  productId: string,
  partId: string,
  options: { exhibited?: boolean } = {}
): Catalog {
  return mapProduct(catalog, productId, (product) => {
    // Attaching the same part twice would print it twice and count it twice.
    if (product.parts.some((link) => link.partId === partId)) return product
    const link: ProductPart = {
      partId,
      exhibited: options.exhibited ?? false,
      priceCentsOverride: null,
      priceTextOverride: null
    }
    return { ...product, parts: [...product.parts, link] }
  })
}

export function detachPart(catalog: Catalog, productId: string, partId: string): Catalog {
  return mapProduct(catalog, productId, (product) => ({
    ...product,
    parts: product.parts.filter((link) => link.partId !== partId)
  }))
}

export function updateAttachment(
  catalog: Catalog,
  productId: string,
  partId: string,
  change: Partial<Omit<ProductPart, 'partId'>>
): Catalog {
  return mapProduct(catalog, productId, (product) => ({
    ...product,
    parts: product.parts.map((link) => (link.partId === partId ? { ...link, ...change } : link))
  }))
}

/** Drop the override so the catalogue price applies again. */
export function clearOverride(catalog: Catalog, productId: string, partId: string): Catalog {
  return updateAttachment(catalog, productId, partId, { priceCentsOverride: null, priceTextOverride: null })
}

/** Renumber products to the given order; ids not listed keep their relative place at the end. */
export function reorderProducts(catalog: Catalog, orderedIds: readonly string[]): Catalog {
  const rank = new Map(orderedIds.map((id, index) => [id, index]))
  const fallback = orderedIds.length
  const sorted = [...catalog.products].sort(
    (left, right) =>
      (rank.get(left.id) ?? fallback + left.sortIndex) - (rank.get(right.id) ?? fallback + right.sortIndex)
  )
  return withProducts(
    catalog,
    sorted.map((product, index) => ({ ...product, sortIndex: index }))
  )
}
