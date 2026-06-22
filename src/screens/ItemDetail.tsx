import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Check, Bookmark, MapPin, Trash2, Utensils, Compass } from 'lucide-react'
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

  // local buffers for free-text fields; commit to the store on blur
  const [name, setName] = useState(item?.name ?? '')
  const [notes, setNotes] = useState(item?.notes ?? '')

  // re-sync buffers when navigating to a different item
  useEffect(() => {
    setName(item?.name ?? '')
    setNotes(item?.notes ?? '')
  }, [item?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
    else setName(item!.name) // revert empty edits
  }

  function handleDelete() {
    if (confirm(`Delete “${item!.name}”? This can't be undone.`)) {
      deleteItem(item!.id)
      navigate(-1)
    }
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
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            className="mt-1 w-full bg-transparent font-display text-3xl text-ink outline-none"
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

        {/* rating */}
        <Card>
          <Row label="Your rating">
            <StarRating value={item.rating} onChange={(r) => setRating(item.id, r)} size={26} />
          </Row>
        </Card>

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

        {/* map link */}
        {item.mapUrl && (
          <a
            href={item.mapUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-sky/30 py-3 font-semibold text-ink"
          >
            <MapPin size={18} strokeWidth={2.2} /> Open in Maps
          </a>
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

function Recommendations({ recs }: { recs: Recommendation[] }) {
  const food = recs.filter((r) => r.kind === 'food')
  const activities = recs.filter((r) => r.kind === 'activity')
  return (
    <div className="space-y-4">
      {food.length > 0 && (
        <RecGroup title="Where to eat" Icon={Utensils} recs={food} />
      )}
      {activities.length > 0 && (
        <RecGroup title="What to do" Icon={Compass} recs={activities} />
      )}
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
