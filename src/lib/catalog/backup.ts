import type { Catalog, Part, Product, ProductPart } from '@/lib/catalog/types'

/**
 * Backup as one JSON file.
 *
 * The catalogue lives in the browser, and browser storage is not a place to keep
 * the only copy of a shop's price list: a cleared profile, a new machine or a
 * different address and it is gone. This is the file that goes on the network
 * drive.
 *
 * Reading is deliberately forgiving about missing fields but strict about the
 * envelope, so a wrong file is rejected outright rather than importing as an
 * empty catalogue.
 */

export const BACKUP_FORMAT = 'printerr-catalog'
export const BACKUP_VERSION = 1

export interface Backup {
  readonly format: typeof BACKUP_FORMAT
  readonly version: number
  readonly exportedAt: string
  readonly catalog: Catalog
}

export function toBackup(catalog: Catalog, now: Date = new Date()): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    catalog
  }
}

export function backupFileName(now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 10)
  return `preisschilder-sicherung-${stamp}.json`
}

export type BackupResult =
  | { readonly ok: true; readonly catalog: Catalog; readonly exportedAt: string | null }
  | { readonly ok: false; readonly error: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null)
const count = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

function readPart(raw: unknown): Part | null {
  if (!isRecord(raw)) return null
  const id = text(raw.id)
  const name = text(raw.name)
  if (!id || !name) return null
  return {
    id,
    name,
    artNr: text(raw.artNr),
    priceCents: typeof raw.priceCents === 'number' ? raw.priceCents : null,
    priceText: text(raw.priceText)
  }
}

function readAttachment(raw: unknown): ProductPart | null {
  if (!isRecord(raw)) return null
  const partId = text(raw.partId)
  if (!partId) return null
  return {
    partId,
    exhibited: raw.exhibited === true,
    priceCentsOverride: typeof raw.priceCentsOverride === 'number' ? raw.priceCentsOverride : null,
    priceTextOverride: text(raw.priceTextOverride)
  }
}

function readProduct(raw: unknown, index: number): Product | null {
  if (!isRecord(raw)) return null
  const id = text(raw.id)
  const name = text(raw.name)
  if (!id || !name) return null
  return {
    id,
    name,
    subtitle: text(raw.subtitle),
    artNr: text(raw.artNr),
    priceCents: count(raw.priceCents, 0),
    priceNote: text(raw.priceNote),
    note: text(raw.note),
    copies: Math.max(1, Math.trunc(count(raw.copies, 1))),
    preselected: raw.preselected !== false,
    layout: text(raw.layout),
    parts: Array.isArray(raw.parts)
      ? raw.parts.map((link) => readAttachment(link)).filter((link) => link !== null)
      : [],
    sortIndex: count(raw.sortIndex, index)
  }
}

export function parseBackup(json: string): BackupResult {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, error: 'Die Datei ist keine gültige JSON-Sicherung.' }
  }

  if (!isRecord(raw)) return { ok: false, error: 'Die Datei enthält keine Sicherung.' }
  if (raw.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'Diese Datei stammt nicht aus der Preisschilder-Sicherung.' }
  }
  if (typeof raw.version === 'number' && raw.version > BACKUP_VERSION) {
    return {
      ok: false,
      error: `Die Sicherung wurde mit einer neueren Version erstellt (Format ${raw.version}).`
    }
  }
  if (!isRecord(raw.catalog)) return { ok: false, error: 'Der Sicherung fehlen die Daten.' }

  const catalogRaw = raw.catalog
  const products = Array.isArray(catalogRaw.products)
    ? catalogRaw.products.map((entry, index) => readProduct(entry, index)).filter((entry) => entry !== null)
    : []
  const parts = Array.isArray(catalogRaw.parts)
    ? catalogRaw.parts.map((entry) => readPart(entry)).filter((entry) => entry !== null)
    : []

  // Attachments pointing at parts the file does not contain would resolve to
  // nothing; dropping them here keeps the imported catalogue self-consistent.
  const known = new Set(parts.map((part) => part.id))
  const cleaned = products.map((product) => ({
    ...product,
    parts: product.parts.filter((link) => known.has(link.partId))
  }))

  return { ok: true, catalog: { products: cleaned, parts }, exportedAt: text(raw.exportedAt) }
}
