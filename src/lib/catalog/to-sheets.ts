import { effectivePrice, partsById } from '@/lib/catalog/resolve'
import type { Catalog } from '@/lib/catalog/types'
import { type CellValue, empty, eur, num, str, writeOds } from '@/lib/ods/write-ods'
import { EXTRA_HEADERS, EXTRA_SHEET, PRODUCT_HEADERS, PRODUCT_SHEET } from '@/lib/schema/columns'

/**
 * The catalogue back out as a spreadsheet.
 *
 * Deliberately flat, add-ons repeated per product: that is what the sheet format
 * is, and what makes the file useful for the things Calc does better than any
 * editor -- raising every price at once, sorting by maker, mailing the list to a
 * colleague. Overrides are written as the price that actually applies, so the
 * exported sheet prints exactly what the app prints.
 */
export function catalogToOds(catalog: Catalog): Uint8Array {
  const parts = partsById(catalog.parts)
  const ordered = [...catalog.products].sort((left, right) => left.sortIndex - right.sortIndex)

  const productRows: CellValue[][] = ordered.map((product) => [
    str(product.id),
    str(product.name),
    product.subtitle === null ? empty() : str(product.subtitle),
    product.artNr === null ? empty() : str(product.artNr),
    eur(product.priceCents),
    product.priceNote === null ? empty() : str(product.priceNote),
    product.note === null ? empty() : str(product.note),
    num(product.copies),
    str(product.preselected ? 'ja' : 'nein'),
    product.layout === null ? empty() : str(product.layout)
  ])

  const extraRows: CellValue[][] = ordered.flatMap((product) =>
    product.parts.flatMap((link) => {
      const part = parts.get(link.partId)
      if (!part) return []
      const { priceCents, priceText } = effectivePrice(link, part)
      return [
        [
          str(product.id),
          str(part.name),
          part.artNr === null ? empty() : str(part.artNr),
          priceCents === null ? empty() : eur(priceCents),
          priceText === null ? empty() : str(priceText),
          str(link.exhibited ? 'ja' : 'nein')
        ]
      ]
    })
  )

  return writeOds([
    { name: PRODUCT_SHEET, rows: [PRODUCT_HEADERS.map((heading) => str(heading)), ...productRows] },
    { name: EXTRA_SHEET, rows: [EXTRA_HEADERS.map((heading) => str(heading)), ...extraRows] }
  ])
}
