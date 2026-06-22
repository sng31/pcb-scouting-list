import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import { useStore, selectCounts, selectCategoryCount, selectRecentlyVisited } from '../store'
import { CATEGORIES, CATEGORY_LABEL, AREA_LABEL } from '../types'
import { CATEGORY_META } from '../components/categoryMeta'

// Sunset Spots and the settling-in Checklist live in other tabs / phases;
// the Home grid shows the explorable place categories.
const TILE_CATEGORIES = CATEGORIES.filter((c) => c !== 'task')

export default function Home() {
  const items = useStore((s) => s.items)
  const counts = selectCounts(items)
  const recent = selectRecentlyVisited(items)

  return (
    <div className="animate-rise">
      {/* ── Hero with wave divider ── */}
      <header className="relative bg-seafoam/15 px-5 pt-10 pb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-seafoam">
          Gulf Coast · Florida
        </p>
        <h1 className="mt-1 text-4xl leading-tight text-ink">PCB Scouting List</h1>
        <p className="mt-2 max-w-xs text-muted">
          Your scouting list for Panama City Beach &amp; the surrounding coast.
        </p>
        <Wave />
      </header>

      <div className="space-y-7 px-5 py-6">
        {/* ── Quick stats ── */}
        <section className="grid grid-cols-3 gap-3">
          <Stat label="Want to try" value={counts.want} tone="text-coral" />
          <Stat label="Been there" value={counts.been} tone="text-seafoam" />
          <Stat label="Favorites" value={counts.favorites} tone="text-ink" />
        </section>

        {/* ── Category tiles ── */}
        <section>
          <h2 className="mb-3 text-xl text-ink">Explore</h2>
          <div className="grid grid-cols-2 gap-3">
            {TILE_CATEGORIES.map((cat) => {
              const { Icon, accent } = CATEGORY_META[cat]
              const count = selectCategoryCount(items, cat)
              return (
                <Link
                  key={cat}
                  to={`/browse?cat=${cat}`}
                  className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-coastal-sm)] transition-transform active:scale-[0.98]"
                >
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-card)] ${accent}`}>
                    <Icon size={22} strokeWidth={1.9} className="text-ink" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">
                      {CATEGORY_LABEL[cat]}
                    </span>
                    <span className="text-sm text-muted">{count} places</span>
                  </span>
                </Link>
              )
            })}
          </div>
        </section>

        {/* ── Recently visited ── */}
        <section>
          <h2 className="mb-3 text-xl text-ink">Recently visited</h2>
          {recent.length === 0 ? (
            <p className="rounded-[var(--radius-card)] bg-surface p-4 text-sm text-muted shadow-[var(--shadow-coastal-sm)]">
              Mark a place as <span className="font-semibold text-seafoam">Been</span> and it’ll
              show up here.
            </p>
          ) : (
            <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
              {recent.map((it) => (
                <Link
                  key={it.id}
                  to={`/item/${it.id}`}
                  className="w-40 shrink-0 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-coastal-sm)]"
                >
                  <span className="block truncate font-semibold text-ink">{it.name}</span>
                  <span className="text-xs text-muted">{AREA_LABEL[it.area]}</span>
                  {it.rating && (
                    <span className="mt-2 flex items-center gap-0.5 text-sunshine">
                      {Array.from({ length: it.rating }).map((_, i) => (
                        <Star key={i} size={13} fill="currentColor" strokeWidth={0} />
                      ))}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-surface p-4 text-center shadow-[var(--shadow-coastal-sm)]">
      <div className={`font-display text-3xl ${tone}`}>{value}</div>
      <div className="mt-0.5 text-xs text-muted">{label}</div>
    </div>
  )
}

function Wave() {
  return (
    <svg
      className="mt-4 -mb-2 block w-full text-sand"
      viewBox="0 0 400 24"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0 12c40 0 40 10 80 10s40-14 80-14 40 12 80 12 40-12 80-12 40 10 80 10v16H0z"
        fill="currentColor"
      />
    </svg>
  )
}
