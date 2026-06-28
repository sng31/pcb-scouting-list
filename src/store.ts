import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Area, Category, Item, Rating, Status } from './types'
import seedData from './data/seed.json'
import { idbStorage } from './storage'

const STORAGE_KEY = 'pcb-scouting-list'
const SCHEMA_VERSION = 2

const now = () => new Date().toISOString()
const today = () => new Date().toISOString().slice(0, 10) // YYYY-MM-DD

// result of a "check for new places" sync against the bundled seed
export interface SyncResult {
  added: number // brand-new places pulled in
  enriched: number // existing places whose seed-owned content was refreshed
}

interface CoastalState {
  version: number
  items: Item[]
  seededAt?: string
  lastSyncedAt?: string

  // true once async (IndexedDB) hydration has finished; gates first render
  hasHydrated: boolean
  setHasHydrated: (v: boolean) => void

  // mutations
  addItem: (draft: NewItemDraft) => Item
  updateItem: (id: string, patch: Partial<Item>) => void
  deleteItem: (id: string) => void
  toggleStatus: (id: string) => void
  setRating: (id: string, rating: Rating) => void
  toggleFavorite: (id: string) => void
  syncFromSeed: () => SyncResult
  importData: (data: { version: number; items: Item[]; seededAt?: string }) => void
  resetToSeed: () => void

  // internal
  _seed: () => void
}

// Fields owned by the seed (app-provided content), safe to refresh on sync.
// Deliberately EXCLUDES user-owned fields: status, rating, favorite, notes,
// dateVisited, tags, favoriteDishes.
const SEED_OWNED_FIELDS = [
  'recommendations',
  'description',
  'mapUrl',
  'website',
  'address',
  'cuisine',
  'priceTier',
] as const satisfies readonly (keyof Item)[]

// minimal fields needed to create an item; the rest get sensible defaults
export interface NewItemDraft {
  name: string
  category: Category
  area: Area
  status?: Status
  description?: string
  mapUrl?: string
  website?: string
  cuisine?: string
  priceTier?: 1 | 2 | 3 | 4
  tags?: string[]
}

export const useStore = create<CoastalState>()(
  persist(
    (set, get) => ({
      version: SCHEMA_VERSION,
      items: [],
      seededAt: undefined,
      lastSyncedAt: undefined,

      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),

      addItem: (draft) => {
        const ts = now()
        const item: Item = {
          id: crypto.randomUUID(),
          name: draft.name.trim(),
          category: draft.category,
          area: draft.area,
          status: draft.status ?? 'want',
          rating: null,
          favorite: false,
          description: draft.description,
          mapUrl: draft.mapUrl,
          website: draft.website,
          cuisine: draft.cuisine,
          priceTier: draft.priceTier,
          notes: '',
          tags: draft.tags ?? [],
          createdAt: ts,
          updatedAt: ts,
        }
        set((s) => ({ items: [item, ...s.items] }))
        return item
      },

      updateItem: (id, patch) =>
        set((s) => ({
          items: s.items.map((it) =>
            it.id === id ? { ...it, ...patch, updatedAt: now() } : it,
          ),
        })),

      deleteItem: (id) =>
        set((s) => ({ items: s.items.filter((it) => it.id !== id) })),

      toggleStatus: (id) =>
        set((s) => ({
          items: s.items.map((it) => {
            if (it.id !== id) return it
            const status: Status = it.status === 'want' ? 'been' : 'want'
            // stamp dateVisited the first time it becomes "been"
            const dateVisited =
              status === 'been' && !it.dateVisited ? today() : it.dateVisited
            return { ...it, status, dateVisited, updatedAt: now() }
          }),
        })),

      setRating: (id, rating) =>
        set((s) => ({
          items: s.items.map((it) =>
            it.id === id ? { ...it, rating, updatedAt: now() } : it,
          ),
        })),

      toggleFavorite: (id) =>
        set((s) => ({
          items: s.items.map((it) =>
            it.id === id
              ? { ...it, favorite: !it.favorite, updatedAt: now() }
              : it,
          ),
        })),

      importData: (data) =>
        set({
          version: data.version ?? SCHEMA_VERSION,
          items: data.items,
          seededAt: data.seededAt ?? now(),
          lastSyncedAt: now(),
        }),

      resetToSeed: () => get()._seed(),

      // "Check for new places": pull the latest bundled seed into the store
      // WITHOUT clobbering the user's own data. Adds places that aren't here yet
      // and refreshes seed-owned content (e.g. excursion recommendations) on
      // places the user already has. User edits (status/rating/notes/etc.) stay.
      syncFromSeed: () => {
        const seed = (seedData as { items: Item[] }).items
        const seedById = new Map(seed.map((s) => [s.id, s]))
        const existingIds = new Set(get().items.map((it) => it.id))

        let added = 0
        let enriched = 0

        const next = get().items.map((cur) => {
          const s = seedById.get(cur.id)
          if (!s) return cur
          const patch: Partial<Item> = {}
          for (const f of SEED_OWNED_FIELDS) {
            if (s[f] !== undefined && JSON.stringify(s[f]) !== JSON.stringify(cur[f])) {
              ;(patch as Record<string, unknown>)[f] = s[f]
            }
          }
          if (Object.keys(patch).length === 0) return cur
          enriched++
          return { ...cur, ...patch, updatedAt: now() }
        })

        for (const s of seed) {
          if (!existingIds.has(s.id)) {
            next.push(s)
            added++
          }
        }

        set({ items: next, lastSyncedAt: now() })
        return { added, enriched }
      },

      _seed: () => {
        const seed = seedData as { items: Item[] }
        set({ items: seed.items, seededAt: now(), lastSyncedAt: now() })
      },
    }),
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => idbStorage),
      migrate: (persisted: unknown, fromVersion: number) => {
        const state = persisted as { items: Item[]; version: number; seededAt?: string; lastSyncedAt?: string }
        if (fromVersion < 2) {
          state.items = (state.items ?? []).map((item) =>
            (item.area as string) === 'excursion'
              ? { ...item, area: 'surrounding' as Area }
              : item,
          )
        }
        return state
      },
      partialize: (s) => ({
        version: s.version,
        items: s.items,
        seededAt: s.seededAt,
        lastSyncedAt: s.lastSyncedAt,
      }),
      // IndexedDB hydrates asynchronously, so the first-run seed (spec §3) can't
      // run synchronously after create() like it did with localStorage — it must
      // wait until the persisted data is in. If nothing was persisted, `seededAt`
      // is still unset → this is a first run → load the bundled seed. After that
      // the user's data is authoritative and the seed never overwrites it.
      onRehydrateStorage: () => (state) => {
        if (!state) return
        if (!state.seededAt) state._seed()
        state.setHasHydrated(true)
      },
    },
  ),
)

// ── Derived selectors (pure helpers over the items array) ────────────

export const selectByCategory = (items: Item[], category: Category) =>
  items.filter((it) => it.category === category)

export const selectCounts = (items: Item[]) => ({
  want: items.filter((it) => it.status === 'want' && it.category !== 'task').length,
  been: items.filter((it) => it.status === 'been' && it.category !== 'task').length,
  favorites: items.filter((it) => it.favorite).length,
})

export const selectCategoryCount = (items: Item[], category: Category) =>
  items.filter((it) => it.category === category).length

export const selectRecentlyVisited = (items: Item[], limit = 8) =>
  items
    .filter((it) => it.status === 'been' && it.dateVisited && it.category !== 'task')
    .sort((a, b) => (a.dateVisited! < b.dateVisited! ? 1 : -1))
    .slice(0, limit)
