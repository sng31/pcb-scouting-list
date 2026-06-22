import { useSearchParams, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useStore, selectByCategory } from '../store'
import { CATEGORIES, CATEGORY_LABEL } from '../types'
import type { Category } from '../types'
import { CATEGORY_META } from '../components/categoryMeta'
import ItemCard from '../components/ItemCard'

// Browse covers the explorable place categories; tasks live in the Checklist tab.
const BROWSE_CATEGORIES = CATEGORIES.filter((c) => c !== 'task')

function isBrowseCategory(value: string | null): value is Category {
  return !!value && (BROWSE_CATEGORIES as string[]).includes(value)
}

export default function Browse() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const items = useStore((s) => s.items)

  const catParam = params.get('cat')
  const active: Category = isBrowseCategory(catParam) ? catParam : 'restaurant'

  const list = selectByCategory(items, active).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div>
      {/* sticky header: title + category switcher */}
      <div className="sticky top-0 z-10 bg-sand/95 px-5 pt-6 pb-3 backdrop-blur">
        <h1 className="text-2xl text-ink">Browse</h1>
        <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
          {BROWSE_CATEGORIES.map((cat) => {
            const { Icon } = CATEGORY_META[cat]
            const selected = cat === active
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setParams({ cat }, { replace: true })}
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
      </div>

      {/* list */}
      <div className="space-y-3 px-5 pt-3 pb-6">
        <p className="text-sm text-muted">
          {list.length} {list.length === 1 ? 'place' : 'places'}
        </p>
        {list.length === 0 ? (
          <p className="rounded-[var(--radius-card)] bg-surface p-6 text-center text-muted shadow-[var(--shadow-coastal-sm)]">
            Nothing here yet. Tap{' '}
            <span className="font-semibold text-coral">+</span> to add the first one.
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
