import {
  UtensilsCrossed,
  Umbrella,
  Ticket,
  Map,
  ShoppingBasket,
  Sunset,
  CheckSquare,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { Category } from '../types'

type IconType = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>

// icon + soft accent (a token bg class) per category, shared across screens
export const CATEGORY_META: Record<Category, { Icon: IconType; accent: string }> = {
  restaurant: { Icon: UtensilsCrossed, accent: 'bg-coral/25' },
  beach: { Icon: Umbrella, accent: 'bg-sky/35' },
  activity: { Icon: Ticket, accent: 'bg-seafoam/25' },
  excursion: { Icon: Map, accent: 'bg-sunshine/40' },
  market: { Icon: ShoppingBasket, accent: 'bg-coral/20' },
  sunset: { Icon: Sunset, accent: 'bg-sunshine/45' },
  task: { Icon: CheckSquare, accent: 'bg-seafoam/20' },
}
