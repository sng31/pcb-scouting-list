import { Link } from 'react-router-dom'
import type { Item } from '../types'
import { useStore } from '../store'
import AreaChip from './AreaChip'
import StatusPill from './StatusPill'
import StarRating from './StarRating'
import FavoriteButton from './FavoriteButton'

// Browse / list card: name, area chip, status pill, star rating, favorite.
// The whole card links to the detail screen; the heart toggles in place.
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
    </Link>
  )
}
