import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useStore } from '../store'
import { CATEGORIES, CATEGORY_LABEL } from '../types'
import type { Category } from '../types'
import { CATEGORY_META } from '../components/categoryMeta'
import ItemCard from '../components/ItemCard'

const PLACE_CATEGORIES = CATEGORIES.filter((c) => c !== 'task')

export default function Favorites() {
  const items = useStore((s) => s.items)
  const favorites = items
    .filter((it) => it.favorite && it.category !== 'task')
    .sort((a, b) => a.name.localeCompare(b.name))

  const groups = PLACE_CATEGORIES.map((cat) => ({
    cat,
    items: favorites.filter((it) => it.category === cat),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="animate-rise">
      <div className="sticky top-0 z-10 bg-sand/95 px-5 pt-6 pb-3 backdrop-blur">
        <h1 className="text-2xl text-ink">Favorites</h1>
        <p className="mt-0.5 text-sm text-muted">
          {favorites.length === 0
            ? 'None saved yet'
            : `${favorites.length} saved place${favorites.length === 1 ? '' : 's'}`}
        </p>
      </div>

      <div className="space-y-7 px-5 pb-6">
        {favorites.length === 0 ? (
          <EmptyFavorites />
        ) : (
          groups.map(({ cat, items }) => (
            <section key={cat}>
              <CategoryHeader cat={cat} />
              <div className="mt-2 space-y-3">
                {items.map((it) => (
                  <ItemCard key={it.id} item={it} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}

function CategoryHeader({ cat }: { cat: Category }) {
  const { Icon, accent } = CATEGORY_META[cat]
  return (
    <div className="flex items-center gap-2">
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${accent}`}>
        <Icon size={15} strokeWidth={2} className="text-ink" />
      </span>
      <h2 className="font-semibold text-ink">{CATEGORY_LABEL[cat]}</h2>
    </div>
  )
}

function EmptyFavorites() {
  return (
    <div className="rounded-[var(--radius-card)] bg-surface p-8 text-center shadow-[var(--shadow-coastal-sm)]">
      <Heart size={36} strokeWidth={1.4} className="mx-auto mb-3 text-line" />
      <p className="font-semibold text-ink">No favorites yet</p>
      <p className="mt-1 text-sm text-muted">
        Tap the heart on any place to save it here.
      </p>
      <Link
        to="/browse"
        className="mt-5 inline-block rounded-[var(--radius-pill)] bg-coral px-6 py-2.5 text-sm font-semibold text-surface"
      >
        Browse places
      </Link>
    </div>
  )
}
