import { type DBSchema, type IDBPDatabase, openDB } from 'idb'

import { createSafeStorage, type SafeStorage } from '@/infra/safe-storage'
import type { Catalog, Part, Product } from '@/lib/catalog/types'
import { EMPTY_CATALOG } from '@/lib/catalog/types'

/**
 * Where the price list lives.
 *
 * IndexedDB, which is available wherever the app is served over https. The
 * localStorage fallback covers the cases where a browser refuses it anyway --
 * a locked-down profile, or opening the built files straight off disk, where
 * Chrome denies IndexedDB outright. A few hundred products fit either way.
 *
 * The whole catalogue is written in one transaction rather than record by
 * record: a half-finished save could otherwise leave a product pointing at a
 * part that was never stored.
 */

const DB_NAME = 'printerr'
const DB_VERSION = 1
const LOCAL_KEY = 'catalog'

interface CatalogDb extends DBSchema {
  products: { key: string; value: Product }
  parts: { key: string; value: Part }
}

export type StoreKind = 'indexeddb' | 'localstorage'

export interface CatalogStore {
  readonly kind: StoreKind
  /** False when the data lives only in memory and will not survive a reload. */
  readonly persistent: boolean
  load(): Promise<Catalog>
  save(catalog: Catalog): Promise<void>
  clear(): Promise<void>
}

async function openCatalogDb(): Promise<IDBPDatabase<CatalogDb> | null> {
  try {
    if (!globalThis.indexedDB) return null
    return await openDB<CatalogDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('products')) db.createObjectStore('products', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('parts')) db.createObjectStore('parts', { keyPath: 'id' })
      }
    })
  } catch {
    // SecurityError on file:// in Chrome, or a browser with storage switched off.
    return null
  }
}

function indexedDbStore(db: IDBPDatabase<CatalogDb>): CatalogStore {
  return {
    kind: 'indexeddb',
    persistent: true,

    async load() {
      const [products, parts] = await Promise.all([db.getAll('products'), db.getAll('parts')])
      return { products, parts }
    },

    async save(catalog) {
      const tx = db.transaction(['products', 'parts'], 'readwrite')
      const products = tx.objectStore('products')
      const parts = tx.objectStore('parts')
      await Promise.all([products.clear(), parts.clear()])
      await Promise.all([
        ...catalog.products.map((product) => products.put(product)),
        ...catalog.parts.map((part) => parts.put(part))
      ])
      await tx.done
    },

    async clear() {
      const tx = db.transaction(['products', 'parts'], 'readwrite')
      await Promise.all([tx.objectStore('products').clear(), tx.objectStore('parts').clear()])
      await tx.done
    }
  }
}

function localStorageStore(storage: SafeStorage): CatalogStore {
  return {
    kind: 'localstorage',
    persistent: storage.persistent,
    load: () => Promise.resolve(storage.read<Catalog>(LOCAL_KEY, EMPTY_CATALOG)),
    save: (catalog) => {
      storage.write(LOCAL_KEY, catalog)
      return Promise.resolve()
    },
    clear: () => {
      storage.remove(LOCAL_KEY)
      return Promise.resolve()
    }
  }
}

export async function createCatalogStore(deps: { storage?: SafeStorage } = {}): Promise<CatalogStore> {
  const db = await openCatalogDb()
  if (db) return indexedDbStore(db)
  return localStorageStore(deps.storage ?? createSafeStorage())
}
