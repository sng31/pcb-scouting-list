import { useState } from 'react'
import { Heart } from 'lucide-react'

interface Props {
  favorite: boolean
  onToggle: () => void
  size?: number
  className?: string
}

// Heart toggle with a small bounce on activation (spec §6 motion).
export default function FavoriteButton({ favorite, onToggle, size = 22, className = '' }: Props) {
  const [bounce, setBounce] = useState(false)
  return (
    <button
      type="button"
      aria-label={favorite ? 'Remove favorite' : 'Add favorite'}
      aria-pressed={favorite}
      onClick={(e) => {
        e.preventDefault() // don't trigger an enclosing card link
        e.stopPropagation()
        setBounce(true)
        onToggle()
      }}
      onAnimationEnd={() => setBounce(false)}
      className={`grid place-items-center rounded-[var(--radius-pill)] p-1 ${bounce ? 'animate-pop' : ''} ${className}`}
    >
      <Heart
        size={size}
        strokeWidth={1.9}
        className={favorite ? 'text-coral' : 'text-muted'}
        fill={favorite ? 'currentColor' : 'none'}
      />
    </button>
  )
}
