/**
 * The contract between the seller's spreadsheet and the app.
 *
 * German column headings live here and nowhere else; everything downstream works
 * with the English field names. Matching is deliberately forgiving, because a
 * shop's price list gets edited by several people over years.
 */

/** Sheet and column names as written into the template and the example file. */
export const PRODUCT_SHEET = 'Produkte'
export const EXTRA_SHEET = 'Zusätze'

export const PRODUCT_HEADERS = [
  'ID',
  'Name',
  'Untertitel',
  'ArtNr',
  'Preis',
  'Preiszusatz',
  'Hinweis',
  'Anzahl',
  'Drucken',
  'Layout'
] as const

export const EXTRA_HEADERS = ['ProduktID', 'Bezeichnung', 'ArtNr', 'Preis', 'Preistext', 'Ausgestellt'] as const

/**
 * Fold a heading to its comparison form.
 *
 * Umlauts become their two-letter spelling first, so "Zusätze" and "Zusaetze"
 * meet at the same string; then everything that is not a letter or digit goes,
 * which makes "Art.-Nr." and "ArtNr" identical.
 */
export function normalizeHeading(raw: string): string {
  return raw
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .replaceAll(/[^a-z0-9]/gu, '')
}

export type ProductField =
  | 'id'
  | 'name'
  | 'subtitle'
  | 'artNr'
  | 'price'
  | 'priceNote'
  | 'note'
  | 'copies'
  | 'print'
  | 'layout'

export type ExtraField = 'productId' | 'name' | 'artNr' | 'price' | 'priceText' | 'exhibited'

type Aliases<T extends string> = Readonly<Record<T, readonly string[]>>

export const PRODUCT_COLUMNS: Aliases<ProductField> = {
  id: ['id', 'nr', 'schildid', 'produktid', 'kennung'],
  name: ['name', 'bezeichnung', 'produkt', 'artikel', 'titel'],
  subtitle: ['untertitel', 'hersteller', 'beschreibung', 'zusatzinfo', 'material'],
  artNr: ['artnr', 'artikelnummer', 'artikelnr', 'nummer'],
  price: ['preis', 'grundpreis', 'verkaufspreis', 'vk'],
  priceNote: ['preiszusatz', 'preishinweis', 'preisanmerkung'],
  note: ['hinweis', 'fusszeile', 'anmerkung', 'bemerkung'],
  copies: ['anzahl', 'menge', 'stueckzahl', 'stueck'],
  print: ['drucken', 'auswahl', 'aktiv', 'auswaehlen'],
  layout: ['layout', 'vorlage', 'variante']
}

export const EXTRA_COLUMNS: Aliases<ExtraField> = {
  productId: ['produktid', 'id', 'schildid', 'gehoertzu', 'zugehoerigzu'],
  name: ['bezeichnung', 'name', 'zusatz', 'teil', 'position'],
  artNr: ['artnr', 'artikelnummer', 'artikelnr', 'nummer'],
  price: ['preis', 'betrag', 'einzelpreis'],
  priceText: ['preistext', 'preisangabe', 'freitext', 'preisinfo'],
  exhibited: ['ausgestellt', 'inausstellung', 'ausstellung', 'dabei', 'enthalten']
}

export const PRODUCT_SHEET_ALIASES = ['produkte', 'produkt', 'artikel', 'schilder', 'preisschilder', 'tabelle1']
export const EXTRA_SHEET_ALIASES = ['zusaetze', 'zusatz', 'positionen', 'teile', 'figuren', 'tabelle2']

/** Which fields a row cannot do without. */
export const REQUIRED_PRODUCT_FIELDS: readonly ProductField[] = ['id', 'name', 'price']
export const REQUIRED_EXTRA_FIELDS: readonly ExtraField[] = ['productId', 'name']

/**
 * Map heading cells to fields.
 *
 * First alias wins, and a field already claimed is not overwritten -- so a sheet
 * carrying both "Preis" and "Betrag" binds Preis, the canonical name.
 */
export function mapHeadings<T extends string>(
  headings: readonly string[],
  aliases: Aliases<T>
): Readonly<Partial<Record<T, number>>> {
  const found: Partial<Record<T, number>> = {}

  for (const [field, candidates] of Object.entries(aliases) as [T, readonly string[]][]) {
    for (const candidate of candidates) {
      if (found[field] !== undefined) break
      const index = headings.findIndex((heading) => normalizeHeading(heading) === candidate)
      if (index !== -1) found[field] = index
    }
  }

  return found
}
