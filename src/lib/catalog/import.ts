import { type Catalog, makeId, type Part, type Product, type ProductPart } from '@/lib/catalog/types'
import type { Label, LabelExtra } from '@/lib/types'

/**
 * Folding flat sheet rows into a catalogue with a shared parts list.
 *
 * A spreadsheet repeats an add-on for every product it hangs on, so the same
 * figure arrives several times over. Here those rows collapse into one part, and
 * any row whose price differs from the first becomes an override on that one
 * attachment -- nothing is silently rounded away, and the shop keeps whatever it
 * had actually entered.
 */

/**
 * What makes two rows the same part.
 *
 * An article number is the shop's own identity for a thing and wins outright.
 * Without one, the name has to serve; it is folded the same way column headings
 * are, so "Bergmann " and "bergmann" meet.
 */
export function partKey(extra: Pick<LabelExtra, 'name' | 'artNr'>): string {
  const artNr = extra.artNr?.trim()
  if (artNr) return `nr:${artNr.toLowerCase()}`
  return `name:${extra.name.trim().toLowerCase().replaceAll(/\s+/gu, ' ')}`
}

const samePrice = (part: Part, extra: LabelExtra): boolean =>
  part.priceCents === extra.priceCents && (part.priceText ?? null) === (extra.priceText ?? null)

export interface ImportSummary {
  readonly catalog: Catalog
  /** How many sheet rows collapsed into an existing part. */
  readonly mergedRows: number
  /** Attachments that had to keep their own price because it differed. */
  readonly overrides: number
}

export function catalogFromLabels(labels: readonly Label[]): ImportSummary {
  const parts: Part[] = []
  const byKey = new Map<string, Part>()
  let mergedRows = 0
  let overrides = 0

  const products: Product[] = labels.map((label, index) => {
    const links: ProductPart[] = label.extras.map((extra) => {
      const key = partKey(extra)
      let part = byKey.get(key)

      if (part) {
        mergedRows += 1
      } else {
        part = {
          id: makeId('t'),
          name: extra.name,
          artNr: extra.artNr,
          priceCents: extra.priceCents,
          priceText: extra.priceText
        }
        byKey.set(key, part)
        parts.push(part)
      }

      // Same part, different price on this product: keep it as an override
      // rather than letting the first row win everywhere.
      const differs = !samePrice(part, extra)
      if (differs) overrides += 1

      return {
        partId: part.id,
        exhibited: extra.exhibited,
        priceCentsOverride: differs ? extra.priceCents : null,
        priceTextOverride: differs ? extra.priceText : null
      }
    })

    return {
      id: label.id,
      name: label.name,
      subtitle: label.subtitle,
      artNr: label.artNr,
      priceCents: label.priceCents,
      priceNote: label.priceNote,
      note: label.note,
      copies: label.copies,
      preselected: label.preselected,
      layout: label.layout,
      parts: links,
      sortIndex: index
    }
  })

  return { catalog: { products, parts }, mergedRows, overrides }
}
