// Phase 1 — storage hardening.
//
// Persistence moves from localStorage → IndexedDB. zustand's `persist` only
// needs a StateStorage (getItem/setItem/removeItem of strings); we back that
// with a tiny single-store IDB key/value table — no dependency, stays lean.
//
// IDB survives larger payloads and, paired with navigator.storage.persist(),
// is far less likely to be evicted than localStorage. The adapter also performs
// a one-time, transparent migration: the first read lifts any existing
// localStorage payload into IDB so returning users keep their data.

import type { StateStorage } from 'zustand/middleware'

const DB_NAME = 'pcb-scouting-list'
const STORE_NAME = 'keyval'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = run(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export const idbStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const val = await tx<string | undefined>('readonly', (s) => s.get(name))
      if (val != null) return val
      // One-time migration: lift the legacy localStorage payload into IDB.
      const legacy = localStorage.getItem(name)
      if (legacy != null) {
        await tx('readwrite', (s) => s.put(legacy, name))
        localStorage.removeItem(name)
        return legacy
      }
      return null
    } catch {
      // IDB unavailable (e.g. private mode in some browsers) — fall back so the
      // app still works, just without the durability upgrade.
      return localStorage.getItem(name)
    }
  },
  setItem: async (name, value) => {
    try {
      await tx('readwrite', (s) => s.put(value, name))
    } catch {
      try {
        localStorage.setItem(name, value)
      } catch {
        /* nothing we can do — data stays in memory for this session */
      }
    }
  },
  removeItem: async (name) => {
    try {
      await tx('readwrite', (s) => s.delete(name))
    } catch {
      localStorage.removeItem(name)
    }
  },
}

// ── navigator.storage helpers (storage-status readout + persistence) ──────

export interface StorageStatus {
  /** Browser exposes the StorageManager estimate API. */
  supported: boolean
  /** Storage is durable (won't be cleared under pressure) vs best-effort. */
  persisted: boolean
  usageBytes?: number
  quotaBytes?: number
}

/**
 * Ask the browser to make storage durable. Idempotent: returns true if already
 * granted. The prompt (if any) is browser-controlled; on many it's auto-granted
 * for installed PWAs / engaged sites.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}

export async function getStorageStatus(): Promise<StorageStatus> {
  const supported = typeof navigator.storage?.estimate === 'function'
  let persisted = false
  if (navigator.storage?.persisted) {
    try {
      persisted = await navigator.storage.persisted()
    } catch {
      /* leave as false */
    }
  }
  if (!supported) return { supported, persisted }
  try {
    const { usage, quota } = await navigator.storage.estimate()
    return { supported, persisted, usageBytes: usage, quotaBytes: quota }
  } catch {
    return { supported, persisted }
  }
}
