import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Wand2 } from 'lucide-react'
import { useStore } from '../store'
import {
  CATEGORIES,
  AREAS,
  CATEGORY_LABEL_SINGULAR,
  AREA_LABEL,
} from '../types'
import type { Area, Category } from '../types'

// ── Maps URL parser ──────────────────────────────────────────────────
// Extracts place name and guesses area from standard Google / Apple Maps URLs.
// Short links (maps.app.goo.gl) can't be expanded client-side — returns nothing.

interface ParsedPlace {
  name?: string
  area?: Area
}

function parseMapsUrl(raw: string): ParsedPlace {
  try {
    const url = new URL(raw.trim())
    const host = url.hostname.replace('www.', '')
    let name: string | undefined
    let lat: number | undefined
    let lng: number | undefined

    if (host === 'google.com' && url.pathname.includes('/maps')) {
      const placeMatch = url.pathname.match(/\/(?:place|search)\/([^/@]+)/)
      if (placeMatch) name = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
      if (!name) name = url.searchParams.get('q') ?? undefined
      const coordMatch = raw.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
      if (coordMatch) { lat = parseFloat(coordMatch[1]); lng = parseFloat(coordMatch[2]) }
    } else if (host === 'maps.google.com') {
      name = url.searchParams.get('q') ?? undefined
      if (name?.match(/^-?\d+\.?\d*,-?\d+\.?\d*$/)) name = undefined
    } else if (host === 'maps.apple.com') {
      name = url.searchParams.get('q') ?? undefined
      const ll = url.searchParams.get('ll')
      if (ll) { const [a, b] = ll.split(','); lat = parseFloat(a); lng = parseFloat(b) }
    }

    const area = lat != null && lng != null ? coordsToArea(lat, lng) : undefined
    return { name, area }
  } catch {
    return {}
  }
}

function coordsToArea(lat: number, lng: number): Area {
  const inBayCounty = lat > 29.9 && lat < 30.5 && lng > -86.2 && lng < -85.3
  if (!inBayCounty) return 'excursion'
  if (lat < 30.2 && lng < -85.7) return 'pcb'
  if (lat < 30.3 && lng > -85.75) return 'panama-city'
  return 'surrounding'
}

// ────────────────────────────────────────────────────────────────────

export default function AddItem() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const addItem = useStore((s) => s.addItem)

  const catParam = params.get('cat') as Category | null
  const initialCat: Category =
    catParam && (CATEGORIES as string[]).includes(catParam) ? catParam : 'restaurant'

  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>(initialCat)
  const [area, setArea] = useState<Area>('pcb')
  const [description, setDescription] = useState('')
  const [mapUrl, setMapUrl] = useState('')
  const [autoFilled, setAutoFilled] = useState(false)

  const canSave = name.trim().length > 0

  function handleMapUrlChange(raw: string) {
    setMapUrl(raw)
    setAutoFilled(false)
    if (!raw.trim()) return
    const parsed = parseMapsUrl(raw.trim())
    let filled = false
    if (parsed.name && !name.trim()) { setName(parsed.name); filled = true }
    if (parsed.area) { setArea(parsed.area); filled = true }
    if (filled) setAutoFilled(true)
  }

  function save() {
    if (!canSave) return
    const item = addItem({
      name,
      category,
      area,
      description: description.trim() || undefined,
      mapUrl: mapUrl.trim() || undefined,
    })
    navigate(`/item/${item.id}`, { replace: true })
  }

  return (
    <div className="px-5 py-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="-ml-1 mb-4 flex items-center gap-1 text-muted"
      >
        <ChevronLeft size={20} /> Back
      </button>

      <h1 className="text-2xl text-ink">Add a place</h1>

      <div className="mt-5 space-y-5">

        {/* Maps link first — can auto-fill name + area */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-muted">
            Maps link (optional)
          </label>
          <input
            value={mapUrl}
            onChange={(e) => handleMapUrlChange(e.target.value)}
            type="url"
            inputMode="url"
            placeholder="Paste a Google or Apple Maps link…"
            className="w-full rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 text-ink outline-none placeholder:text-muted/60 focus:border-seafoam"
          />
          {autoFilled && (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-seafoam">
              <Wand2 size={12} strokeWidth={2.2} /> Name and area filled from the link
            </p>
          )}
          {mapUrl.trim() && !autoFilled && !parseMapsUrl(mapUrl).name && (
            <p className="mt-1.5 text-xs text-muted">
              Short links can't be read — fill in the name below.
            </p>
          )}
        </div>

        <Field label="Name">
          <input
            autoFocus={!mapUrl}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sunset Grille"
            className="w-full rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 text-ink outline-none placeholder:text-muted/60 focus:border-seafoam"
          />
        </Field>

        <Field label="Category">
          <Select value={category} onChange={(v) => setCategory(v as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL_SINGULAR[c]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Area">
          <Select value={area} onChange={(v) => setArea(v as Area)}>
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {AREA_LABEL[a]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="A short blurb about this place"
            className="w-full resize-none rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 text-ink outline-none placeholder:text-muted/60 focus:border-seafoam"
          />
        </Field>

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

function Select({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
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
