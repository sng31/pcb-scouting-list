// Data model — spec §3. One unified Item type covers every category;
// category-specific fields are optional.

export type Category =
  | 'restaurant'
  | 'beach'
  | 'activity'
  | 'excursion'
  | 'market'
  | 'sunset'
  | 'task'

export type Area = 'pcb' | 'panama-city' | 'surrounding'

export type Status = 'want' | 'been' // tasks reuse this as todo/done

export type Rating = 1 | 2 | 3 | 4 | 5 | null // null = unrated

// A researched local recommendation attached to a destination (esp. excursions):
// where to eat and what to do / local gems worth the trip.
export interface Recommendation {
  name: string
  kind: 'food' | 'activity'
  blurb: string // short researched note on why it's worth it
  mapUrl?: string
}

export interface Item {
  id: string
  name: string
  category: Category
  area: Area
  status: Status
  rating: Rating
  favorite: boolean
  description?: string // short app-provided blurb (seed); distinct from user notes
  notes: string // the user's own notes — never pre-filled by seed
  tags: string[]

  // location (all optional)
  address?: string
  mapUrl?: string
  website?: string

  // restaurant-specific (optional)
  cuisine?: string
  priceTier?: 1 | 2 | 3 | 4 // $ to $$$$
  favoriteDishes?: string[]

  // excursion-specific (optional): researched food + activity recommendations
  recommendations?: Recommendation[]

  // metadata
  dateVisited?: string // ISO date
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
}

export interface AppData {
  version: number
  items: Item[]
  seededAt?: string
}

// ── Display metadata ─────────────────────────────────────────────────

export const CATEGORIES: Category[] = [
  'restaurant',
  'beach',
  'activity',
  'excursion',
  'market',
  'sunset',
  'task',
]

export const CATEGORY_LABEL: Record<Category, string> = {
  restaurant: 'Restaurants',
  beach: 'Beaches',
  activity: 'Activities',
  excursion: 'Excursions',
  market: 'Markets',
  sunset: 'Sunset Spots',
  task: 'Checklist',
}

// singular form, for buttons / detail headers
export const CATEGORY_LABEL_SINGULAR: Record<Category, string> = {
  restaurant: 'Restaurant',
  beach: 'Beach',
  activity: 'Activity',
  excursion: 'Excursion',
  market: 'Market',
  sunset: 'Sunset Spot',
  task: 'Task',
}

export const AREA_LABEL: Record<Area, string> = {
  pcb: 'PCB',
  'panama-city': 'Panama City',
  surrounding: 'Surrounding',
}

export const AREAS: Area[] = ['pcb', 'panama-city', 'surrounding']

// status label varies for tasks (todo/done) vs places (want/been)
export function statusLabel(status: Status, category: Category): string {
  if (category === 'task') return status === 'want' ? 'To do' : 'Done'
  return status === 'want' ? 'Want to try' : 'Been'
}
