import { describe, expect, it } from 'vitest'

import { parseBoolean, parseCents, parseCount } from '@/lib/schema/parse-number'

// Collapses the result union so a table of cases stays readable: a number means
// parsed, a string means the failure reason.
const cents = (raw: string): number | string => {
  const result = parseCents(raw)
  return result.ok ? result.value : result.reason
}

const count = (raw: string): number | string => {
  const result = parseCount(raw)
  return result.ok ? result.value : result.reason
}

describe('parseCents', () => {
  it('reads the German decimal comma', () => {
    expect(cents('12,50')).toBe(1250)
    expect(cents('12,5')).toBe(1250)
    expect(cents('0,07')).toBe(7)
  })

  it('treats the dot as a thousands separator once a comma is present', () => {
    expect(cents('1.148,00')).toBe(114_800)
    expect(cents('1.234.567,89')).toBe(123_456_789)
  })

  it('reads a bare integer as whole euros', () => {
    expect(cents('1148')).toBe(114_800)
    expect(cents('0')).toBe(0)
  })

  it('disambiguates a lone dot by the length of the group after it', () => {
    // Three digits can only be a thousands group, so 1.148 is eleven hundred euros.
    expect(cents('1.148')).toBe(114_800)
    expect(cents('1.234.567')).toBe(123_456_700)
    // One or two digits cannot be a thousands group, so this is twelve fifty.
    expect(cents('12.50')).toBe(1250)
    expect(cents('12.5')).toBe(1250)
  })

  it('ignores currency symbols and every kind of space', () => {
    expect(cents('12,50 €')).toBe(1250)
    expect(cents('€ 12,50')).toBe(1250)
    expect(cents('  890  ')).toBe(89_000)
    expect(cents('1 148,00')).toBe(114_800)
    // No-break space and narrow no-break space -- what Intl and Calc actually emit.
    expect(cents('1 148,00')).toBe(114_800)
    expect(cents('1 148,00')).toBe(114_800)
  })

  it('rounds to whole cents commercially', () => {
    expect(cents('12,999')).toBe(1300)
    expect(cents('12,994')).toBe(1299)
    expect(cents('12,995')).toBe(1300)
  })

  it('keeps the sign', () => {
    expect(cents('-5,00')).toBe(-500)
    expect(cents('+5,00')).toBe(500)
  })

  it('reports an empty cell separately from a broken one', () => {
    // The caller treats these differently: empty is fine for an optional column,
    // unparseable earns a diagnostic pointing at the cell.
    expect(cents('')).toBe('empty')
    expect(cents('   ')).toBe('empty')
    expect(cents('€')).toBe('empty')
  })

  it('refuses anything with letters in it', () => {
    // "ab 90" is a legitimate thing for a seller to write, but it is a price
    // *text*, not a price -- it belongs in the Preistext column.
    expect(cents('ab 90')).toBe('not-a-number')
    expect(cents('abc')).toBe('not-a-number')
    expect(cents('90 EUR')).toBe('not-a-number')
  })

  it('refuses separators without any digits', () => {
    expect(cents('.')).toBe('not-a-number')
    expect(cents(',')).toBe('not-a-number')
    expect(cents('-')).toBe('not-a-number')
  })

  it('refuses amounts too large to stay exact', () => {
    expect(cents('999999999999999999999')).toBe('out-of-range')
  })
})

describe('parseCount', () => {
  it('reads whole numbers', () => {
    expect(count('2')).toBe(2)
    expect(count('2,0')).toBe(2)
    expect(count('10')).toBe(10)
  })

  it('refuses fractions, because half a label cannot be printed', () => {
    expect(count('2,5')).toBe('not-a-number')
  })

  it('passes empty through so the caller can apply its default', () => {
    expect(count('')).toBe('empty')
  })
})

describe('parseBoolean', () => {
  it('reads the spellings a German seller would type', () => {
    expect(parseBoolean('ja')).toBe(true)
    expect(parseBoolean('Ja')).toBe(true)
    expect(parseBoolean('JA')).toBe(true)
    expect(parseBoolean('x')).toBe(true)
    expect(parseBoolean('nein')).toBe(false)
    expect(parseBoolean('Nein')).toBe(false)
    expect(parseBoolean('-')).toBe(false)
  })

  it('returns null for empty and for anything it does not recognise', () => {
    // Null means "not stated", which lets each column pick its own default.
    expect(parseBoolean('')).toBeNull()
    expect(parseBoolean('   ')).toBeNull()
    expect(parseBoolean('vielleicht')).toBeNull()
  })
})
