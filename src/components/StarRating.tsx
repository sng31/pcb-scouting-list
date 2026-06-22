import { Star } from 'lucide-react'
import type { Rating } from '../types'

interface Props {
  value: Rating
  /** when provided, the row is interactive (tap to set, tap the same star to clear) */
  onChange?: (rating: Rating) => void
  size?: number
  className?: string
}

// Shared star row. Read-only when no onChange is passed (cards); tappable in
// the detail screen. Tapping the current rating again clears it to null.
export default function StarRating({ value, onChange, size = 18, className = '' }: Props) {
  const interactive = !!onChange
  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {([1, 2, 3, 4, 5] as const).map((n) => {
        const filled = value != null && n <= value
        const star = (
          <Star
            size={size}
            strokeWidth={1.8}
            className={filled ? 'text-sunshine' : 'text-line'}
            fill={filled ? 'currentColor' : 'none'}
          />
        )
        if (!interactive) return <span key={n}>{star}</span>
        return (
          <button
            key={n}
            type="button"
            aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
            className="p-0.5 transition-transform active:scale-90"
            onClick={() => onChange(value === n ? null : (n as Rating))}
          >
            {star}
          </button>
        )
      })}
    </div>
  )
}
