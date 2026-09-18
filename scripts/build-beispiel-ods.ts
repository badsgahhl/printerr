import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { type CellValue, empty, eur, num, str, writeOds } from '../src/lib/ods/write-ods'
import { EXTRA_HEADERS, EXTRA_SHEET, PRODUCT_HEADERS, PRODUCT_SHEET } from '../src/lib/schema/columns'

/**
 * Generates the spreadsheets that ship with the app: an empty template, a worked
 * example, and one full of mistakes for demonstrating the diagnostics panel.
 *
 * Run with `pnpm beispiele`.
 */

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'beispiele')

const headers = (names: readonly string[]): CellValue[] => names.map((name) => str(name))

/** ID, Name, Untertitel, ArtNr, Preis, Preiszusatz, Hinweis, Anzahl, Drucken, Layout */
const product = (
  id: string,
  name: string,
  subtitle: string,
  artNr: string,
  priceCents: number,
  priceNote = '',
  note = '',
  copies = 1,
  print = 'ja'
): CellValue[] => [
  str(id),
  str(name),
  str(subtitle),
  str(artNr),
  eur(priceCents),
  priceNote === '' ? empty() : str(priceNote),
  note === '' ? empty() : str(note),
  num(copies),
  str(print),
  empty()
]

/** ProduktID, Bezeichnung, ArtNr, Preis, Preistext, Ausgestellt */
const extra = (
  productId: string,
  name: string,
  artNr: string,
  priceCents: number | null,
  priceText = '',
  exhibited = 'nein'
): CellValue[] => [
  str(productId),
  str(name),
  artNr === '' ? empty() : str(artNr),
  priceCents === null ? empty() : eur(priceCents),
  priceText === '' ? empty() : str(priceText),
  str(exhibited)
]

const HANDWORK = 'Handarbeit aus dem Erzgebirge'

const EXAMPLE_PRODUCTS: CellValue[][] = [
  product('R-01', 'Räuchermann Bergmann', 'KWO · Erle, handbemalt', '6011', 8900, '', HANDWORK),
  product('E-01', 'Engel mit Kerze', 'Wendt & Kühn · Ahorn', '2201', 4250, '', HANDWORK, 2),
  product('S-01', 'Schwibbogen „Bergparade"', 'Seiffener Volkskunst · 72 cm', '3302', 14_900),
  product('N-01', 'Nussknacker König', 'Richard Glässer · 40 cm', '6120', 17_900, '', HANDWORK, 1, 'nein'),
  product('M-01', 'Mühle „Seiffen"', 'KWO · Erle, handbemalt', '4711', 89_000, 'ohne Figuren', HANDWORK),
  product('P-01', 'Weihnachtspyramide, 4-stöckig', 'Seiffener Volkskunst · 78 cm', '5510', 129_000, 'Grundmodell')
]

const EXAMPLE_EXTRAS: CellValue[][] = [
  extra('M-01', 'Bergmann', '4712', 12_900, '', 'ja'),
  extra('M-01', 'Engel', '4713', 12_900, '', 'ja'),
  extra('M-01', 'weitere Figuren', '', null, 'ab 90,00 €'),
  extra('P-01', 'Bergmann-Figuren (6 Stück)', '5511', 18_000, '', 'ja'),
  extra('P-01', 'Teelicht-Set', '5512', 2400, '', 'ja'),
  extra('S-01', 'Ersatzkerzen', '3303', 490)
]

// Every row here breaks a different rule, so the diagnostics panel can be shown
// doing its job without anyone having to damage the real price list.
const BROKEN_PRODUCTS: CellValue[][] = [
  product('R-01', 'Räuchermann Bergmann', 'KWO · Erle', '6011', 8900),
  product('R-01', 'Räuchermann, nochmal dieselbe ID', 'KWO', '6012', 9900),
  [empty(), str('Schild ohne ID'), empty(), empty(), eur(4900), empty(), empty(), empty(), empty(), empty()],
  [
    str('X-01'),
    str('Preis als Text'),
    empty(),
    empty(),
    str('auf Anfrage'),
    empty(),
    empty(),
    empty(),
    empty(),
    empty()
  ],
  product('M-01', 'Mühle ohne Figurenpreis', 'KWO', '4711', 89_000, 'ohne Figuren')
]

const BROKEN_EXTRAS: CellValue[][] = [
  extra('M-01', 'Figuren', '', null, 'ab 90,00 €', 'ja'),
  extra('TIPPFEHLER', 'Zusatz ohne passendes Schild', '', 1000),
  extra('R-01', 'Zusatz ohne jeden Preis', '', null)
]

function write(fileName: string, products: CellValue[][], extras: CellValue[][]): void {
  const bytes = writeOds([
    { name: PRODUCT_SHEET, rows: [headers(PRODUCT_HEADERS), ...products] },
    { name: EXTRA_SHEET, rows: [headers(EXTRA_HEADERS), ...extras] }
  ])
  const target = join(OUT_DIR, fileName)
  writeFileSync(target, bytes)
  console.log(`${fileName}  (${bytes.length} Bytes, ${products.length} Schilder, ${extras.length} Zusätze)`)
}

mkdirSync(OUT_DIR, { recursive: true })
write('preisschilder-vorlage.ods', [], [])
write('preisschilder-beispiel.ods', EXAMPLE_PRODUCTS, EXAMPLE_EXTRAS)
write('preisschilder-fehlerbeispiel.ods', BROKEN_PRODUCTS, BROKEN_EXTRAS)
