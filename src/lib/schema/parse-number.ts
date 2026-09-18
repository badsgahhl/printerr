/**
 * Number parsing for spreadsheet cells that arrived as text.
 *
 * Numeric cells carry their value in the `office:value` attribute and never come
 * through here. This is the fallback for the seller typing "12,50 EUR" into a
 * cell formatted as text -- which happens, and should produce a usable price
 * rather than a shrug.
 */

export type ParseFailure = 'empty' | 'not-a-number' | 'out-of-range'

export type ParseResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly reason: ParseFailure }

const ok = (value: number): ParseResult => ({ ok: true, value })
const fail = (reason: ParseFailure): ParseResult => ({ ok: false, reason })

/** Currency symbols and every flavour of space, including the narrow no-break one Intl emits. */
const NOISE = /[\s€]/gu
const DIGITS_AND_SEPARATORS = /^[0-9.,]+$/u

interface Split {
  readonly integer: string
  readonly fraction: string
}

/**
 * Decide which of `.` and `,` is the decimal separator.
 *
 * A comma always wins -- German sheets write 1.148,00. Without one, a single
 * trailing group of exactly three digits reads as a thousands separator
 * (1.148 is eleven hundred, not 1.148), anything else as a decimal point
 * (12.50 is twelve fifty).
 */
function splitDecimal(text: string): Split {
  if (text.includes(',')) {
    const lastComma = text.lastIndexOf(',')
    return {
      integer: text.slice(0, lastComma).replaceAll('.', '').replaceAll(',', ''),
      fraction: text.slice(lastComma + 1).replaceAll('.', '')
    }
  }

  const lastDot = text.lastIndexOf('.')
  if (lastDot === -1) return { integer: text, fraction: '' }

  const tail = text.slice(lastDot + 1)
  if (tail.length === 3) return { integer: text.replaceAll('.', ''), fraction: '' }

  return { integer: text.slice(0, lastDot).replaceAll('.', ''), fraction: tail }
}

/** Round a fractional digit string to whole cents, commercially. */
function fractionToCents(fraction: string): number {
  if (fraction.length === 0) return 0
  const twoDigits = Number.parseInt(fraction.slice(0, 2).padEnd(2, '0'), 10)
  const roundsUp = fraction.length > 2 && Number.parseInt(fraction[2] ?? '0', 10) >= 5
  return twoDigits + (roundsUp ? 1 : 0)
}

/**
 * Parse a German-formatted amount into integer cents.
 *
 * Cents stay integers all the way through: 0.07 * 100 is 7.000000000000001 in
 * binary floating point, and a price list must not inherit that.
 */
export function parseCents(raw: string): ParseResult {
  const cleaned = raw.replaceAll(NOISE, '')
  if (cleaned.length === 0) return fail('empty')

  const negative = cleaned.startsWith('-')
  const unsigned = negative || cleaned.startsWith('+') ? cleaned.slice(1) : cleaned
  if (unsigned.length === 0 || !DIGITS_AND_SEPARATORS.test(unsigned)) return fail('not-a-number')

  const { integer, fraction } = splitDecimal(unsigned)
  if (integer.length > 0 && !/^[0-9]+$/u.test(integer)) return fail('not-a-number')
  if (fraction.length > 0 && !/^[0-9]+$/u.test(fraction)) return fail('not-a-number')
  if (integer.length === 0 && fraction.length === 0) return fail('not-a-number')

  const cents = (integer.length === 0 ? 0 : Number.parseInt(integer, 10)) * 100 + fractionToCents(fraction)
  if (!Number.isSafeInteger(cents)) return fail('out-of-range')

  return ok(negative ? -cents : cents)
}

/** Parse a whole-number count such as the Anzahl column. Rejects fractions outright. */
export function parseCount(raw: string): ParseResult {
  const parsed = parseCents(raw)
  if (!parsed.ok) return parsed
  if (parsed.value % 100 !== 0) return fail('not-a-number')
  return ok(parsed.value / 100)
}

/** Reads the German yes/no spellings a seller is likely to type. */
export function parseBoolean(raw: string): boolean | null {
  const text = raw.trim().toLowerCase()
  if (text.length === 0) return null
  if (['ja', 'j', 'x', 'wahr', 'yes', 'y', 'true', '1'].includes(text)) return true
  if (['nein', 'n', 'falsch', 'no', 'false', '0', '-'].includes(text)) return false
  return null
}
