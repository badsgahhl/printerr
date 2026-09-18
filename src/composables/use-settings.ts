import { reactive, watch } from 'vue'

import { createSafeStorage, type SafeStorage } from '@/infra/safe-storage'
import { DEFAULT_LABEL_STYLE, type LabelStyle, STYLE_LIMITS } from '@/print/geometry'

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

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

/**
 * Pull a stored style back into range.
 *
 * Stored values come from a previous version of the app or from a browser
 * profile someone copied around; a size outside its limits would produce a
 * label nobody can read, so it is corrected rather than trusted.
 */
export function normalizeStyle(raw: Partial<LabelStyle> | undefined): LabelStyle {
  const source = { ...DEFAULT_LABEL_STYLE, ...raw }
  const fix = (value: unknown, key: keyof typeof STYLE_LIMITS): number => {
    const limits = STYLE_LIMITS[key]
    return typeof value === 'number' && Number.isFinite(value)
      ? clamp(value, limits.min, limits.max)
      : DEFAULT_LABEL_STYLE[key]
  }

  return {
    paddingMm: fix(source.paddingMm, 'paddingMm'),
    nameMaxPx: fix(source.nameMaxPx, 'nameMaxPx'),
    priceMaxPx: fix(source.priceMaxPx, 'priceMaxPx'),
    detailMaxPx: fix(source.detailMaxPx, 'detailMaxPx')
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
    state.labelStyle = { ...state.labelStyle, [key]: clamp(value, limits.min, limits.max) }
  }

  function resetStyle(): void {
    state.labelStyle = DEFAULT_LABEL_STYLE
  }

  function isStyleDefault(): boolean {
    return (Object.keys(DEFAULT_LABEL_STYLE) as (keyof LabelStyle)[]).every(
      (key) => state.labelStyle[key] === DEFAULT_LABEL_STYLE[key]
    )
  }

  return { state, brand, setStyle, resetStyle, isStyleDefault }
}

export type SettingsStore = ReturnType<typeof createSettings>

export const settings = createSettings()
