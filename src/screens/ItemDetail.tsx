import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Check, Bookmark, MapPin, Trash2, Utensils, Compass, Globe } from 'lucide-react'
import { useStore } from '../store'
import { CATEGORY_LABEL_SINGULAR, AREA_LABEL, statusLabel } from '../types'
import type { Recommendation } from '../types'
import { CATEGORY_META } from '../components/categoryMeta'
import StarRating from '../components/StarRating'
import FavoriteButton from '../components/FavoriteButton'

export default function ItemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const item = useStore((s) => s.items.find((it) => it.id === id))

  const updateItem = useStore((s) => s.updateItem)
  const deleteItem = useStore((s) => s.deleteItem)
  const toggleStatus = useStore((s) => s.toggleStatus)
  const setRating = useStore((s) => s.setRating)
  const toggleFavorite = useStore((s) => s.toggleFavorite)

  const [name, setName] = useState(item?.name ?? '')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const nameRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setName(item?.name ?? '')
    setNotes(item?.notes ?? '')
  }, [item?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // auto-size the name textarea to its content
  useEffect(() => {
    const el = nameRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [name])

  if (!item) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-muted">That place no longer exists.</p>
        <button onClick={() => navigate('/browse')} className="mt-3 font-semibold text-seafoam">
          Back to Browse
        </button>
      </div>
    )
  }

  const { Icon } = CATEGORY_META[item.category]
  const been = item.status === 'been'

  function commitName() {
    const trimmed = name.trim()
    if (trimmed && trimmed !== item!.name) updateItem(item!.id, { name: trimmed })
    else setName(item!.name)
  }

  function handleDelete() {
    if (confirm(`Delete "${item!.name}"? This can't be undone.`)) {
      deleteItem(item!.id)
      navigate(-1)
    }
  }

  function addTag(tag: string) {
    const t = tag.trim().toLowerCase()
    if (t && !item!.tags.includes(t)) {
      updateItem(item!.id, { tags: [...item!.tags, t] })
    }
  }

  function removeTag(tag: string) {
    updateItem(item!.id, { tags: item!.tags.filter((t) => t !== tag) })
  }

  function addDish(dish: string) {
    const d = dish.trim()
    if (d) {
      const existing = item!.favoriteDishes ?? []
      if (!existing.includes(d)) {
        updateItem(item!.id, { favoriteDishes: [...existing, d] })
      }
    }
  }

  function removeDish(dish: string) {
    updateItem(item!.id, {
      favoriteDishes: (item!.favoriteDishes ?? []).filter((d) => d !== dish),
    })
  }

  return (
    <div className="animate-rise pb-6">
      {/* header bar */}
      <div className="flex items-center justify-between px-5 pt-6">
        <button onClick={() => navigate(-1)} className="-ml-1 flex items-center gap-1 text-muted">
          <ChevronLeft size={20} /> Back
        </button>
        <FavoriteButton favorite={item.favorite} onToggle={() => toggleFavorite(item.id)} size={24} />
      </div>

      <div className="space-y-5 px-5 pt-3">
        {/* category + area + name */}
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-muted">
            <Icon size={16} strokeWidth={2} />
            {CATEGORY_LABEL_SINGULAR[item.category]} · {AREA_LABEL[item.area]}
          </div>
          <textarea
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            rows={1}
            className="mt-1 w-full resize-none overflow-hidden bg-transparent font-display text-3xl text-ink outline-none"
          />
        </div>

        {/* status toggle */}
        <button
          type="button"
          onClick={() => toggleStatus(item.id)}
          className={`flex w-full items-center justify-center gap-2 rounded-[var(--radius-pill)] py-3 font-semibold transition-colors ${
            been ? 'bg-seafoam text-surface' : 'bg-coral/15 text-coral'
          }`}
        >
          {been ? <Check size={18} strokeWidth={2.6} /> : <Bookmark size={18} strokeWidth={2.4} />}
          {statusLabel(item.status, item.category)}
          {been && item.dateVisited && (
            <span className="font-normal opacity-80">· {item.dateVisited}</span>
          )}
        </button>

        {/* rating (non-task only) */}
        {item.category !== 'task' && (
          <Card>
            <Row label="Your rating">
              <StarRating value={item.rating} onChange={(r) => setRating(item.id, r)} size={26} />
            </Row>
          </Card>
        )}

        {/* app blurb */}
        {item.description && (
          <Card>
            <p className="text-ink/90">{item.description}</p>
          </Card>
        )}

        {/* researched recommendations (excursions) */}
        {item.recommendations && item.recommendations.length > 0 && (
          <Recommendations recs={item.recommendations} />
        )}

        {/* favorite dishes (restaurants) */}
        {item.category === 'restaurant' && (
          <DishesEditor
            dishes={item.favoriteDishes ?? []}
            onAdd={addDish}
            onRemove={removeDish}
          />
        )}

        {/* notes */}
        <div>
          <h2 className="mb-1.5 text-sm font-semibold text-muted">Your notes</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== item.notes && updateItem(item.id, { notes })}
            rows={4}
            placeholder="Jot anything — standout dishes, who you went with, what to try next time…"
            className="w-full resize-none rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 text-ink outline-none placeholder:text-muted/60 focus:border-seafoam"
          />
        </div>

        {/* tags */}
        <TagsEditor tags={item.tags} onAdd={addTag} onRemove={removeTag} />

        {/* external links */}
        {(item.mapUrl || item.website) && (
          <div className="flex gap-3">
            {item.mapUrl && (
              <a
                href={item.mapUrl}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-sky/30 py-3 font-semibold text-ink"
              >
                <MapPin size={18} strokeWidth={2.2} /> Maps
              </a>
            )}
            {item.website && (
              <a
                href={item.website}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-sky/30 py-3 font-semibold text-ink"
              >
                <Globe size={18} strokeWidth={2.2} /> Website
              </a>
            )}
          </div>
        )}

        {/* delete */}
        <button
          type="button"
          onClick={handleDelete}
          className="flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-muted"
        >
          <Trash2 size={16} /> Delete
        </button>
      </div>
    </div>
  )
}

function TagsEditor({
  tags,
  onAdd,
  onRemove,
}: {
  tags: string[]
  onAdd: (t: string) => void
  onRemove: (t: string) => void
}) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function submit() {
    const t = input.trim().toLowerCase()
    if (t) {
      onAdd(t)
      setInput('')
    }
  }

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-muted">Tags</h2>
      {tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-[var(--radius-pill)] bg-seafoam/15 px-3 py-1 text-sm font-semibold text-seafoam"
            >
              {tag}
              <button
                type="button"
                onClick={() => onRemove(tag)}
                className="ml-0.5 leading-none text-seafoam/60 hover:text-seafoam"
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Add a tag…"
          className="flex-1 rounded-[var(--radius-card)] border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none placeholder:text-muted/60 focus:border-seafoam"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!input.trim()}
          className="rounded-[var(--radius-pill)] bg-seafoam px-4 py-2 text-sm font-semibold text-surface disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  )
}

function DishesEditor({
  dishes,
  onAdd,
  onRemove,
}: {
  dishes: string[]
  onAdd: (d: string) => void
  onRemove: (d: string) => void
}) {
  const [input, setInput] = useState('')

  function submit() {
    const d = input.trim()
    if (d) {
      onAdd(d)
      setInput('')
    }
  }

  return (
    <div>
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted">
        <Utensils size={14} strokeWidth={2.2} /> Favorite dishes
      </h2>
      {dishes.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {dishes.map((dish) => (
            <span
              key={dish}
              className="flex items-center gap-1 rounded-[var(--radius-pill)] bg-coral/15 px-3 py-1 text-sm font-semibold text-coral"
            >
              {dish}
              <button
                type="button"
                onClick={() => onRemove(dish)}
                className="ml-0.5 leading-none text-coral/60 hover:text-coral"
                aria-label={`Remove dish ${dish}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="e.g. grilled grouper, key lime pie…"
          className="flex-1 rounded-[var(--radius-card)] border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none placeholder:text-muted/60 focus:border-seafoam"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!input.trim()}
          className="rounded-[var(--radius-pill)] bg-coral px-4 py-2 text-sm font-semibold text-surface disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  )
}

function Recommendations({ recs }: { recs: Recommendation[] }) {
  const food = recs.filter((r) => r.kind === 'food')
  const activities = recs.filter((r) => r.kind === 'activity')
  return (
    <div className="space-y-4">
      {food.length > 0 && <RecGroup title="Where to eat" Icon={Utensils} recs={food} />}
      {activities.length > 0 && <RecGroup title="What to do" Icon={Compass} recs={activities} />}
    </div>
  )
}

function RecGroup({
  title,
  Icon,
  recs,
}: {
  title: string
  Icon: typeof Utensils
  recs: Recommendation[]
}) {
  return (
    <div>
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-seafoam">
        <Icon size={15} strokeWidth={2.2} /> {title}
      </h2>
      <div className="space-y-2">
        {recs.map((r) => (
          <div
            key={r.name}
            className="rounded-[var(--radius-card)] bg-surface p-3.5 shadow-[var(--shadow-coastal-sm)]"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-ink">{r.name}</span>
              {r.mapUrl && (
                <a href={r.mapUrl} target="_blank" rel="noreferrer" className="shrink-0 text-seafoam">
                  <MapPin size={16} />
                </a>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted">{r.blurb}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-coastal-sm)]">
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold text-muted">{label}</span>
      {children}
    </div>
  )
}
