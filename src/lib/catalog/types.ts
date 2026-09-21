/**
 * The stored shape of the price list.
 *
 * Distinct from `Label` in lib/types.ts on purpose: a Label is what gets printed,
 * flat and self-contained, while this is what the shop edits and keeps. The two
 * are joined by `resolveLabel`.
 *
 * The split exists because the same figure hangs on several products. Storing it
 * once and pointing at it means a price change lands everywhere at once -- which
 * a spreadsheet, where every add-on is its own row, cannot do.
 */

/** An add-on in the catalogue: a figure, an accessory, a spare part. */
export interface Part {
  readonly id: string
  readonly name: string
  readonly artNr: string | null
  /** The catalogue price. Null when only a free text applies. */
  readonly priceCents: number | null
  /** Free-text price such as "ab 90,00 €", used when there is no number. */
  readonly priceText: string | null
}

/**
 * A part attached to one product.
 *
 * The overrides are the escape hatch: normally the catalogue price applies, but
 * a single product may charge something different without forking the part.
 */
export interface ProductPart {
  readonly partId: string
  /** Stands with the piece in the shop, and therefore counts towards its price. */
  readonly exhibited: boolean
  /** Null means "use the catalogue price". */
  readonly priceCentsOverride: number | null
  readonly priceTextOverride: string | null
}

export interface Product {
  readonly id: string
  readonly name: string
  readonly subtitle: string | null
  readonly artNr: string | null
  readonly priceCents: number
  /** Qualifier printed under the price, e.g. "ohne Figuren". */
  readonly priceNote: string | null
  readonly note: string | null
  readonly copies: number
  readonly preselected: boolean
  readonly layout: string | null
  readonly parts: readonly ProductPart[]
  /** Keeps the shop's own ordering; the sheet's row order on import. */
  readonly sortIndex: number
}

export interface Catalog {
  readonly products: readonly Product[]
  readonly parts: readonly Part[]
}

export const EMPTY_CATALOG: Catalog = { products: [], parts: [] }

/** Generates an id that is readable in a spreadsheet export and unique enough. */
export function makeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${Date.now().toString(36)}${random}`
}

/**
 * A form-editable copy of a stored record.
 *
 * The stored types are readonly on purpose -- every change goes through the pure
 * functions in mutate.ts. A dialog binding with v-model needs something it may
 * write to, so it works on this and hands back a finished record on save.
 */
export type Draft<T> = { -readonly [K in keyof T]: T[K] }
