import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Plus, Search, X } from 'lucide-react'
import { useStore, selectByCategory } from '../store'
import { CATEGORIES, CATEGORY_LABEL, AREAS, AREA_LABEL } from '../types'
import type { Area, Category, Item, Status } from '../types'
import { CATEGORY_META } from '../components/categoryMeta'
import ItemCard from '../components/ItemCard'

const BROWSE_CATEGORIES = CATEGORIES.filter((c) => c !== 'task')

function isBrowseCategory(value: string | null): value is Category {
  return !!value && (BROWSE_CATEGORIES as string[]).includes(value)
}

type SortMode = 'alpha' | 'newest' | 'rating'
type StatusFilter = Status | 'all'
type AreaFilter = Area | 'all'

function applyFilters(
  items: Item[],
  search: string,
  areaFilter: AreaFilter,
  statusFilter: StatusFilter,
  sort: SortMode,
): Item[] {
  let result = items

  if (search.trim()) {
    const q = search.trim().toLowerCase()
    result = result.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        it.description?.toLowerCase().includes(q) ||
        it.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }

  if (areaFilter !== 'all') {
    result = result.filter((it) => it.area === areaFilter)
  }

  if (statusFilter !== 'all') {
    result = result.filter((it) => it.status === statusFilter)
  }

  if (sort === 'alpha') {
    result = [...result].sort((a, b) => a.name.localeCompare(b.name))
  } else if (sort === 'newest') {
    result = [...result].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  } else if (sort === 'rating') {
    result = [...result].sort((a, b) => {
      if (a.rating == null && b.rating == null) return 0
      if (a.rating == null) return 1
      if (b.rating == null) return -1
      return b.rating - a.rating
    })
  }

  return result
}

export default function Browse() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const items = useStore((s) => s.items)

  const catParam = params.get('cat')
  const active: Category = isBrowseCategory(catParam) ? catParam : 'restaurant'

  const [search, setSearch] = useState('')
  const [areaFilter, setAreaFilter] = useState<AreaFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortMode>('alpha')

  const raw = selectByCategory(items, active)
  const list = applyFilters(raw, search, areaFilter, statusFilter, sort)

  // Only show area filter when items in this category span more than one area
  const availableAreas = [...new Set(raw.map((it) => it.area))]
  const showAreaFilter = availableAreas.length > 1

  const hasFilters = search || (showAreaFilter && areaFilter !== 'all') || statusFilter !== 'all'

  function clearFilters() {
    setSearch('')
    setAreaFilter('all')
    setStatusFilter('all')
    setSort('alpha')
  }

  const SORT_LABELS: Record<SortMode, string> = { alpha: 'A–Z', newest: 'Newest', rating: 'Top rated' }
  const SORT_CYCLE: SortMode[] = ['alpha', 'newest', 'rating']

  function cycleSort() {
    const next = SORT_CYCLE[(SORT_CYCLE.indexOf(sort) + 1) % SORT_CYCLE.length]
    setSort(next)
  }

  return (
    <div>
      {/* sticky header */}
      <div className="sticky top-0 z-10 space-y-2.5 bg-sand/95 px-5 pt-6 pb-3 backdrop-blur">
        <h1 className="text-2xl text-ink">Browse</h1>

        {/* category tabs */}
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5">
          {BROWSE_CATEGORIES.map((cat) => {
            const { Icon } = CATEGORY_META[cat]
            const selected = cat === active
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setParams({ cat }, { replace: true })
                  clearFilters()
                  setAreaFilter('all')
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] px-3.5 py-2 text-sm font-semibold transition-colors ${
                  selected
                    ? 'bg-seafoam text-surface shadow-[var(--shadow-coastal-sm)]'
                    : 'bg-surface text-muted'
                }`}
              >
                <Icon size={16} strokeWidth={2} />
                {CATEGORY_LABEL[cat]}
              </button>
            )
          })}
        </div>

        {/* search */}
        <div className="relative">
          <Search
            size={16}
            strokeWidth={2}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, tag…"
            className="w-full rounded-[var(--radius-pill)] border border-line bg-surface py-2.5 pl-9 pr-9 text-base text-ink outline-none placeholder:text-muted/60 focus:border-seafoam"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* filter bar */}
      <div className="border-b border-line px-5 pb-3 pt-2">
        <div className="-mx-5 flex items-center gap-2 overflow-x-auto px-5 pb-0.5">
          {/* area chips — hidden when category only has one area */}
          {showAreaFilter && (
            <>
              {([['all', 'All'] as const, ...AREAS.map((a) => [a, AREA_LABEL[a]] as const)]).map(
                ([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAreaFilter(val as AreaFilter)}
                    className={`shrink-0 rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold transition-colors ${
                      areaFilter === val ? 'bg-sky/40 text-ink' : 'bg-surface text-muted'
                    }`}
                  >
                    {label}
                  </button>
                ),
              )}
              <div className="mx-1 h-4 w-px shrink-0 bg-line" />
            </>
          )}

          {/* status filter */}
          {(['all', 'want', 'been'] as const).map((s) => {
            const label = s === 'all' ? 'All' : s === 'want' ? 'Want' : 'Been'
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`shrink-0 rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold transition-colors ${
                  statusFilter === s
                    ? s === 'been'
                      ? 'bg-seafoam/25 text-ink'
                      : s === 'want'
                      ? 'bg-coral/20 text-ink'
                      : 'bg-surface text-ink border border-line'
                    : 'bg-surface text-muted'
                }`}
              >
                {label}
              </button>
            )
          })}

          <div className="mx-1 h-4 w-px shrink-0 bg-line" />

          {/* sort */}
          <button
            type="button"
            onClick={cycleSort}
            className="shrink-0 rounded-[var(--radius-pill)] bg-surface px-3 py-1.5 text-xs font-semibold text-muted"
          >
            ↕ {SORT_LABELS[sort]}
          </button>
        </div>
      </div>

      {/* list */}
      <div className="space-y-3 px-5 pt-3 pb-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            {list.length} {list.length === 1 ? 'place' : 'places'}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold text-coral"
            >
              Clear filters
            </button>
          )}
        </div>

        {list.length === 0 ? (
          <p className="rounded-[var(--radius-card)] bg-surface p-6 text-center text-muted shadow-[var(--shadow-coastal-sm)]">
            {hasFilters ? (
              <>
                No results.{' '}
                <button onClick={clearFilters} className="font-semibold text-coral">
                  Clear filters
                </button>
              </>
            ) : (
              <>
                Nothing here yet. Tap <span className="font-semibold text-coral">+</span> to add
                the first one.
              </>
            )}
          </p>
        ) : (
          list.map((item) => <ItemCard key={item.id} item={item} />)
        )}
      </div>

      {/* floating + Add */}
      <button
        type="button"
        aria-label="Add a place"
        onClick={() => navigate(`/item/new?cat=${active}`)}
        className="fixed bottom-24 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-[var(--radius-pill)] bg-coral px-5 py-3 font-semibold text-surface shadow-[var(--shadow-coastal)] transition-transform active:scale-95"
      >
        <Plus size={20} strokeWidth={2.4} />
        Add
      </button>
    </div>
  )
}
