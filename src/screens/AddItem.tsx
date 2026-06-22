import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useStore } from '../store'
import {
  CATEGORIES,
  AREAS,
  CATEGORY_LABEL_SINGULAR,
  AREA_LABEL,
} from '../types'
import type { Area, Category } from '../types'

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

  const canSave = name.trim().length > 0

  function save() {
    if (!canSave) return
    const item = addItem({
      name,
      category,
      area,
      description: description.trim() || undefined,
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
        <Field label="Name">
          <input
            autoFocus
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
