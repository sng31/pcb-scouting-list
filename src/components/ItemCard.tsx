import { Link } from 'react-router-dom'
import type { Item } from '../types'
import { useStore } from '../store'
import AreaChip from './AreaChip'
import StatusPill from './StatusPill'
import StarRating from './StarRating'
import FavoriteButton from './FavoriteButton'

export default function ItemCard({ item }: { item: Item }) {
  const toggleFavorite = useStore((s) => s.toggleFavorite)

  return (
    <Link
      to={`/item/${item.id}`}
      className="block animate-rise rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-coastal-sm)] transition-transform active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg text-ink">{item.name}</h3>
          {item.description && (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted">{item.description}</p>
          )}
        </div>
        <FavoriteButton
          favorite={item.favorite}
          onToggle={() => toggleFavorite(item.id)}
          className="-mr-1 -mt-1 shrink-0"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusPill status={item.status} category={item.category} />
        <AreaChip area={item.area} />
        {item.rating != null && <StarRating value={item.rating} size={15} className="ml-auto" />}
      </div>

      {item.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-[var(--radius-pill)] bg-seafoam/12 px-2.5 py-0.5 text-xs font-semibold text-seafoam"
            >
              {tag}
            </span>
          ))}
          {item.tags.length > 4 && (
            <span className="text-xs text-muted">+{item.tags.length - 4}</span>
          )}
        </div>
      )}
    </Link>
  )
}
