import { reactive, watch } from 'vue'

import { createSafeStorage, type SafeStorage } from '@/infra/safe-storage'
import { DEFAULT_LABEL_STYLE, type FontSizeKey, type LabelStyle, type SheetGrid, STYLE_LIMITS } from '@/print/geometry'

export interface Settings {
  /** Shop name printed small at the foot of every label. */
  brandText: string
  brandEnabled: boolean
  /** Prints a 100mm bar on the first sheet, to check the print dialog's scaling. */
  showRuler: boolean
  /** Sizes and margin; every size is an upper bound, not a fixed value. */
  labelStyle: LabelStyle
}

const DEFAULTS: Settings = {
  brandText: '',
  brandEnabled: false,
  showRuler: false,
  labelStyle: DEFAULT_LABEL_STYLE
}

const STYLE_KEYS = Object.keys(DEFAULT_LABEL_STYLE) as (keyof LabelStyle)[]

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

/** Settings written before every text had a size of its own. */
interface LegacyStyle {
  /** One size for everything small: subtitle, article number, add-ons, foot. */
  readonly detailMaxPx?: unknown
}

/** What `detailMaxPx` was at its default, and what every small size was a fraction of. */
const LEGACY_DETAIL_MAX_PX = 12

const LEGACY_DETAIL_KEYS: readonly FontSizeKey[] = [
  'subtitleMaxPx',
  'artNrMaxPx',
  'priceSuffixMaxPx',
  'breakdownMaxPx',
  'noteMaxPx',
  'brandMaxPx'
]

/**
 * Carry the old shared small-text size over to the sizes that replaced it.
 *
 * Someone who had turned the small text up should find it still turned up, not
 * quietly reset. Each new size takes the same factor, rounded to its slider's
 * step so the slider can show it exactly.
 */
function fromLegacy(raw: Partial<LabelStyle> & LegacyStyle): Partial<LabelStyle> {
  const legacy = raw.detailMaxPx
  if (typeof legacy !== 'number' || !Number.isFinite(legacy)) return {}

  const factor = legacy / LEGACY_DETAIL_MAX_PX
  const carried: Partial<Record<FontSizeKey, number>> = {}
  for (const key of LEGACY_DETAIL_KEYS) {
    const step = STYLE_LIMITS[key].step
    carried[key] = Math.round((DEFAULT_LABEL_STYLE[key] * factor) / step) * step
  }
  return carried
}

/**
 * Pull a stored style back into range.
 *
 * Stored values come from a previous version of the app or from a browser
 * profile someone copied around; a size outside its limits would produce a
 * label nobody can read, so it is corrected rather than trusted.
 */
export function normalizeStyle(raw: (Partial<LabelStyle> & LegacyStyle) | undefined): LabelStyle {
  const source = { ...DEFAULT_LABEL_STYLE, ...(raw && fromLegacy(raw)), ...raw }
  const fix = (value: unknown, key: keyof typeof STYLE_LIMITS): number => {
    const limits = STYLE_LIMITS[key]
    return typeof value === 'number' && Number.isFinite(value)
      ? clamp(value, limits.min, limits.max)
      : DEFAULT_LABEL_STYLE[key]
  }

  return {
    // Whole numbers only: half a column is not a sheet layout.
    columns: Math.round(fix(source.columns, 'columns')),
    rows: Math.round(fix(source.rows, 'rows')),
    paddingMm: fix(source.paddingMm, 'paddingMm'),
    nameMaxPx: fix(source.nameMaxPx, 'nameMaxPx'),
    subtitleMaxPx: fix(source.subtitleMaxPx, 'subtitleMaxPx'),
    artNrMaxPx: fix(source.artNrMaxPx, 'artNrMaxPx'),
    priceMaxPx: fix(source.priceMaxPx, 'priceMaxPx'),
    priceSuffixMaxPx: fix(source.priceSuffixMaxPx, 'priceSuffixMaxPx'),
    breakdownMaxPx: fix(source.breakdownMaxPx, 'breakdownMaxPx'),
    noteMaxPx: fix(source.noteMaxPx, 'noteMaxPx'),
    brandMaxPx: fix(source.brandMaxPx, 'brandMaxPx')
  }
}

export function createSettings(deps: { storage?: SafeStorage } = {}) {
  const storage = deps.storage ?? createSafeStorage()
  const stored = storage.read<Partial<Settings>>('settings', {})

  const state = reactive<Settings>({
    ...DEFAULTS,
    ...stored,
    labelStyle: normalizeStyle(stored.labelStyle)
  })

  watch(state, () => void storage.write('settings', { ...state }), { deep: true })

  /** What PriceLabel should print, or null to leave the foot empty. */
  function brand(): string | null {
    const text = state.brandText.trim()
    return state.brandEnabled && text.length > 0 ? text : null
  }

  function setStyle<K extends keyof LabelStyle>(key: K, value: number): void {
    const limits = STYLE_LIMITS[key]
    const clamped = clamp(value, limits.min, limits.max)
    state.labelStyle = {
      ...state.labelStyle,
      [key]: key === 'columns' || key === 'rows' ? Math.round(clamped) : clamped
    }
  }

  /** Switch the sheet division without disturbing the size settings. */
  function setGrid(grid: SheetGrid): void {
    state.labelStyle = {
      ...state.labelStyle,
      columns: clamp(Math.round(grid.columns), STYLE_LIMITS.columns.min, STYLE_LIMITS.columns.max),
      rows: clamp(Math.round(grid.rows), STYLE_LIMITS.rows.min, STYLE_LIMITS.rows.max)
    }
  }

  /** Put the named settings back to their defaults, or all of them when none are named. */
  function resetStyle(keys: readonly (keyof LabelStyle)[] = STYLE_KEYS): void {
    const next: Record<keyof LabelStyle, number> = { ...state.labelStyle }
    for (const key of keys) next[key] = DEFAULT_LABEL_STYLE[key]
    state.labelStyle = next
  }

  function isStyleDefault(keys: readonly (keyof LabelStyle)[] = STYLE_KEYS): boolean {
    return keys.every((key) => state.labelStyle[key] === DEFAULT_LABEL_STYLE[key])
  }

  return { state, brand, setStyle, setGrid, resetStyle, isStyleDefault }
}

export type SettingsStore = ReturnType<typeof createSettings>

export const settings = createSettings()
