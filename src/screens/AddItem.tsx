import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Search, Loader2, X, CheckCircle2, Link } from 'lucide-react'
import { useStore } from '../store'
import { CATEGORIES, AREAS, CATEGORY_LABEL_SINGULAR, AREA_LABEL } from '../types'
import type { Area, Category } from '../types'

// ── Google Places (via Cloudflare Worker proxy) ──────────────────────
// The Google key never lives in the app. We POST to our Worker, which holds
// the key as an encrypted secret and returns Google's raw Places JSON.
// See proxy/ and the tech spec §4. VITE_PROXY_URL is NOT a secret.

const PROXY_URL = import.meta.env.VITE_PROXY_URL as string
// Friction-only shared token (NOT a real secret — it ships in the bundle). Matches
// the Worker's PROXY_APP_TOKEN. If unset, the header is omitted and the Worker
// falls back to CORS-only. See proxy/src/index.js and tech spec §4.
const PROXY_TOKEN = import.meta.env.VITE_PROXY_TOKEN as string | undefined

function proxyHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (PROXY_TOKEN) h['X-App-Token'] = PROXY_TOKEN
  return h
}

function proxyError(err: unknown, status: number): string {
  const e = err as { error?: { message?: string } | string } | undefined
  if (e && typeof e.error === 'object') return e.error.message ?? `HTTP ${status}`
  if (e && typeof e.error === 'string') return e.error
  return `HTTP ${status}`
}

interface Suggestion {
  placeId: string
  text: string
  secondary: string
}

interface PlaceFields {
  name: string
  description: string
  mapUrl: string
  website: string
  area: Area
  category: Category
  tags: string[]
  cuisine: string
  priceTier: 1 | 2 | 3 | 4 | undefined
}

async function fetchSuggestions(query: string): Promise<Suggestion[]> {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: proxyHeaders(),
    body: JSON.stringify({ type: 'autocomplete', input: query }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(proxyError(err, res.status))
  }
  const data = await res.json()
  return (data.suggestions ?? []).map((s: Record<string, unknown>) => {
    const p = s.placePrediction as Record<string, unknown>
    const sf = p.structuredFormat as Record<string, Record<string, string>>
    return {
      placeId: p.placeId as string,
      text: sf?.mainText?.text ?? (p.text as Record<string, string>)?.text ?? '',
      secondary: sf?.secondaryText?.text ?? '',
    }
  })
}

async function fetchPlaceDetails(placeId: string): Promise<PlaceFields | null> {
  // The Worker owns the field mask now (kept in sync in proxy/src/index.js).
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: proxyHeaders(),
    body: JSON.stringify({ type: 'details', placeId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(proxyError(err, res.status))
  }
  const p = await res.json()

  const types: string[] = p.types ?? []
  const primaryType: string = p.primaryType ?? ''
  const lat: number | undefined = p.location?.latitude
  const lng: number | undefined = p.location?.longitude

  return {
    name: p.displayName?.text ?? '',
    description: descriptionFromPlace(p),
    mapUrl: p.googleMapsUri ?? '',
    website: p.websiteUri ?? '',
    area: lat != null && lng != null ? coordsToArea(lat, lng) : 'pcb',
    category: typesToCategory(types, primaryType),
    tags: typesToTags(types, primaryType),
    cuisine: typesToCuisine(types, primaryType),
    priceTier: priceLevelToTier(p.priceLevel),
  }
}

// ── Mapping helpers ──────────────────────────────────────────────────

// Prefer Google Maps' AI-generated place summary; fall back to the
// editorial blurb; otherwise leave blank (never raw reviews).
function descriptionFromPlace(p: Record<string, unknown>): string {
  const gen = p.generativeSummary as Record<string, Record<string, string>> | undefined
  const aiText = gen?.overview?.text ?? gen?.description?.text
  if (aiText) return aiText.trim()

  const editorial = (p.editorialSummary as Record<string, string> | undefined)?.text
  if (editorial) return editorial.trim()

  return ''
}

function coordsToArea(lat: number, lng: number): Area {
  if (lat < 30.2 && lng < -85.68 && lng > -86.2) return 'pcb'
  if (lat < 30.3 && lng >= -85.68 && lng < -85.3) return 'panama-city'
  return 'surrounding'
}

const RESTAURANT_TYPES = new Set([
  'restaurant', 'food', 'cafe', 'bar', 'bakery', 'coffee_shop',
  'fast_food_restaurant', 'seafood_restaurant', 'steak_house', 'pizza_restaurant',
  'sandwich_shop', 'meal_takeaway', 'meal_delivery', 'breakfast_restaurant',
  'brunch_restaurant', 'ice_cream_shop',
])
const BEACH_TYPES = new Set(['beach', 'natural_feature'])
const MARKET_TYPES = new Set([
  'grocery_store', 'supermarket', 'convenience_store', 'market',
  'shopping_mall', 'farmers_market', 'store',
])
const ACTIVITY_TYPES = new Set([
  'tourist_attraction', 'amusement_park', 'bowling_alley', 'movie_theater',
  'aquarium', 'zoo', 'stadium', 'golf_course', 'park', 'spa', 'marina',
  'water_park', 'miniature_golf_course', 'escape_room',
])

function typesToCategory(types: string[], primary: string): Category {
  const all = [primary, ...types]
  if (all.some((t) => BEACH_TYPES.has(t))) return 'beach'
  if (all.some((t) => RESTAURANT_TYPES.has(t))) return 'restaurant'
  if (all.some((t) => MARKET_TYPES.has(t))) return 'market'
  if (all.some((t) => ACTIVITY_TYPES.has(t))) return 'activity'
  return 'activity'
}

const TYPE_TAG_MAP: Record<string, string> = {
  seafood_restaurant: 'seafood', bar: 'bar', cafe: 'cafe',
  coffee_shop: 'coffee', beach: 'beach', park: 'outdoor',
  spa: 'spa', pizza_restaurant: 'pizza', bbq_restaurant: 'bbq',
  breakfast_restaurant: 'breakfast', brunch_restaurant: 'brunch',
  ice_cream_shop: 'ice cream', golf_course: 'golf', marina: 'marina',
  water_park: 'water park', live_music_venue: 'live music',
  dog_park: 'dog-friendly', farmers_market: 'farmers market',
}

function typesToTags(types: string[], primary: string): string[] {
  const tags = new Set<string>()
  for (const t of [primary, ...types]) {
    if (TYPE_TAG_MAP[t]) tags.add(TYPE_TAG_MAP[t])
  }
  return [...tags].slice(0, 5)
}

const CUISINE_MAP: Record<string, string> = {
  seafood_restaurant: 'Seafood', italian_restaurant: 'Italian',
  mexican_restaurant: 'Mexican', chinese_restaurant: 'Chinese',
  japanese_restaurant: 'Japanese', sushi_restaurant: 'Sushi',
  thai_restaurant: 'Thai', indian_restaurant: 'Indian',
  american_restaurant: 'American', pizza_restaurant: 'Pizza',
  bbq_restaurant: 'BBQ', breakfast_restaurant: 'Breakfast',
  brunch_restaurant: 'Brunch', sandwich_shop: 'Sandwiches',
  fast_food_restaurant: 'Fast food', steak_house: 'Steakhouse',
  french_restaurant: 'French', greek_restaurant: 'Greek',
}

function typesToCuisine(types: string[], primary: string): string {
  for (const t of [primary, ...types]) {
    if (CUISINE_MAP[t]) return CUISINE_MAP[t]
  }
  return ''
}

function priceLevelToTier(level: string | undefined): 1 | 2 | 3 | 4 | undefined {
  const map: Record<string, 1 | 2 | 3 | 4> = {
    PRICE_LEVEL_FREE: 1, PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  }
  return level ? map[level] : undefined
}

// ── Component ────────────────────────────────────────────────────────

export default function AddItem() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const addItem = useStore((s) => s.addItem)

  const catParam = params.get('cat') as Category | null
  const initialCat: Category =
    catParam && (CATEGORIES as string[]).includes(catParam) ? catParam : 'restaurant'

  // search
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [selectedName, setSelectedName] = useState('')
  const [searchError, setSearchError] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // form fields
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>(initialCat)
  const [area, setArea] = useState<Area>('pcb')
  const [description, setDescription] = useState('')
  const [mapUrl, setMapUrl] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [showUrlField, setShowUrlField] = useState(false)

  const canSave = name.trim().length > 0

  // close suggestions on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!suggestionsRef.current?.contains(e.target as Node)) setSuggestions([])
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleQueryChange(q: string) {
    setQuery(q)
    setSelectedName('')
    clearTimeout(searchTimer.current)
    if (!q.trim()) { setSuggestions([]); return }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      setSearchError('')
      try {
        setSuggestions(await fetchSuggestions(q))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[Places autocomplete]', msg)
        setSearchError(msg)
        setSuggestions([])
      } finally {
        setSearching(false)
      }
    }, 350)
  }

  async function handleSelect(s: Suggestion) {
    setSuggestions([])
    setQuery(s.text)
    setSelectedName(s.text)
    setLoadingDetails(true)
    setSearchError('')
    try {
      const fields = await fetchPlaceDetails(s.placeId)
      if (!fields) { setName(s.text); return }
      setName(fields.name || s.text)
      setCategory(fields.category)
      setArea(fields.area)
      if (fields.description) setDescription(fields.description)
      if (fields.mapUrl) setMapUrl(fields.mapUrl)
      if (fields.tags.length) setTags(fields.tags)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[Places details]', msg)
      setSearchError(msg)
      setName(s.text)
    } finally {
      setLoadingDetails(false)
    }
  }

  function clearSelection() {
    setQuery('')
    setSelectedName('')
    setName('')
    setDescription('')
    setMapUrl('')
    setTags([])
    setCategory(initialCat)
    setArea('pcb')
  }

  function handleMapUrlChange(raw: string) {
    setMapUrl(raw)
  }

  function save() {
    if (!canSave) return
    const item = addItem({
      name, category, area,
      description: description.trim() || undefined,
      mapUrl: mapUrl.trim() || undefined,
      tags: tags.length ? tags : undefined,
    })
    navigate(`/item/${item.id}`, { replace: true })
  }

  return (
    <div className="px-5 py-6">
      <button type="button" onClick={() => navigate(-1)} className="-ml-1 mb-4 flex items-center gap-1 text-muted">
        <ChevronLeft size={20} /> Back
      </button>

      <h1 className="text-2xl text-ink">Add a place</h1>

      <div className="mt-5 space-y-5">

        {/* ── Search ── */}
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-muted">Search</span>
          <div className="relative" ref={suggestionsRef}>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Restaurant, beach, attraction…"
                autoComplete="off"
                className="w-full rounded-[var(--radius-card)] border border-line bg-surface py-3 pl-9 pr-9 text-ink outline-none placeholder:text-muted/60 focus:border-seafoam"
              />
              {(searching || loadingDetails) && (
                <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-muted" />
              )}
              {query && !searching && !loadingDetails && (
                <button type="button" onClick={clearSelection} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                  <X size={16} />
                </button>
              )}
            </div>

            {/* suggestions dropdown */}
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-coastal)]">
                {suggestions.map((s) => (
                  <button
                    key={s.placeId}
                    type="button"
                    onClick={() => handleSelect(s)}
                    className="flex w-full flex-col px-4 py-3 text-left transition-colors active:bg-sand"
                  >
                    <span className="font-semibold text-ink">{s.text}</span>
                    {s.secondary && <span className="text-sm text-muted">{s.secondary}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {searchError && (
            <p className="mt-1.5 text-xs font-semibold text-coral">
              Search unavailable: {searchError}
            </p>
          )}
          {selectedName && !loadingDetails && (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-seafoam">
              <CheckCircle2 size={12} strokeWidth={2.5} /> Details filled from Google Places
            </p>
          )}
        </div>

        {/* ── Name ── */}
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sunset Grille"
            className="w-full rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 text-ink outline-none placeholder:text-muted/60 focus:border-seafoam"
          />
        </Field>

        {/* ── Category ── */}
        <Field label="Category">
          <Select value={category} onChange={(v) => setCategory(v as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL_SINGULAR[c]}</option>
            ))}
          </Select>
        </Field>

        {/* ── Area ── */}
        <Field label="Area">
          <Select value={area} onChange={(v) => setArea(v as Area)}>
            {AREAS.map((a) => (
              <option key={a} value={a}>{AREA_LABEL[a]}</option>
            ))}
          </Select>
        </Field>

        {/* ── Description ── */}
        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="A short blurb about this place"
            className="w-full resize-none rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 text-ink outline-none placeholder:text-muted/60 focus:border-seafoam"
          />
        </Field>

        {/* ── Tags (pre-filled, editable) ── */}
        {tags.length > 0 && (
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-muted">Tags</span>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 rounded-[var(--radius-pill)] bg-seafoam/15 px-3 py-1 text-sm font-semibold text-seafoam">
                  {tag}
                  <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} className="ml-0.5 leading-none text-seafoam/60">×</button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Maps link (collapsible) ── */}
        <div>
          <button
            type="button"
            onClick={() => setShowUrlField(!showUrlField)}
            className="flex items-center gap-1.5 text-sm font-semibold text-muted"
          >
            <Link size={14} strokeWidth={2.2} />
            {showUrlField ? 'Hide Maps link' : 'Add Maps link manually'}
          </button>
          {showUrlField && (
            <input
              value={mapUrl}
              onChange={(e) => handleMapUrlChange(e.target.value)}
              type="url"
              inputMode="url"
              placeholder="Paste a Google or Apple Maps link"
              className="mt-2 w-full rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 text-ink outline-none placeholder:text-muted/60 focus:border-seafoam"
            />
          )}
        </div>

        <button
          type="button"
          disabled={!canSave}
          onClick={save}
          className="w-full rounded-[var(--radius-pill)] bg-coral py-3.5 font-semibold text-surface shadow-[var(--shadow-coastal)] transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-muted">{label}</span>
      {children}
    </label>
  )
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full appearance-none rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 text-ink outline-none focus:border-seafoam"
    >
      {children}
    </select>
  )
}
