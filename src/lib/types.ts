// Domain types. Deliberately free of Vue and DOM so every rule about labels can
// be tested as a plain function.

/** One add-on line under a label: a figure, an accessory, a spare part. */
export interface LabelExtra {
  readonly name: string
  readonly artNr: string | null
  /** Null when the seller gave a free-text price such as "ab 90,00 EUR". */
  readonly priceCents: number | null
  readonly priceText: string | null
  /** Part of the piece as it stands in the shop, and therefore part of its total price. */
  readonly exhibited: boolean
}

export interface Label {
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
  readonly extras: readonly LabelExtra[]
  /** 1-based row in the Produkte sheet, so diagnostics can point the seller at it. */
  readonly sourceRow: number
}

export type DiagnosticCode =
  | 'missing-sheet'
  | 'missing-column'
  | 'missing-id'
  | 'duplicate-id'
  | 'missing-name'
  | 'bad-price'
  | 'unknown-product'
  | 'extra-without-price'
  | 'exhibited-without-price'
  | 'sheet-too-large'
  | 'text-overflow'

export interface Diagnostic {
  readonly severity: 'error' | 'warning'
  readonly code: DiagnosticCode
  readonly sheet: string | null
  /** 1-based, matching what LibreOffice shows in the row header. */
  readonly row: number | null
  readonly column: string | null
  readonly labelId: string | null
  readonly message: string
}
