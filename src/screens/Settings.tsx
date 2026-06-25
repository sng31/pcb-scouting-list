import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useStore, selectCounts } from '../store'
import type { SyncResult } from '../store'

export default function Settings() {
  const items = useStore((s) => s.items)
  const lastSyncedAt = useStore((s) => s.lastSyncedAt)
  const syncFromSeed = useStore((s) => s.syncFromSeed)
  const counts = selectCounts(items)

  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  function checkForNewPlaces() {
    const r: SyncResult = syncFromSeed()
    setSyncMsg(summarize(r))
  }

  return (
    <div className="px-5 py-6">
      <h1 className="text-2xl text-ink">Settings</h1>

      {/* data summary */}
      <section className="mt-5 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-coastal-sm)]">
        <h2 className="text-sm font-semibold text-muted">Your list</h2>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <Mini label="Places" value={items.filter((it) => it.category !== 'task').length} />
          <Mini label="Been" value={counts.been} />
          <Mini label="Favorites" value={counts.favorites} />
        </div>
        {lastSyncedAt && (
          <p className="mt-3 text-xs text-muted">
            Last checked for new places: {new Date(lastSyncedAt).toLocaleString()}
          </p>
        )}
      </section>

      {/* data freshness */}
      <section className="mt-5">
        <h2 className="mb-3 text-xl text-ink">Keep it fresh</h2>

        <ActionRow
          Icon={RefreshCw}
          title="Check for new places"
          subtitle="Pull in any newly added spots and refresh details like excursion recommendations. Your ratings, notes, and favorites are kept."
          button="Check now"
          onClick={checkForNewPlaces}
        />
        {syncMsg && (
          <p className="mt-2 rounded-[var(--radius-card)] bg-seafoam/15 px-4 py-2.5 text-sm font-semibold text-seafoam">
            {syncMsg}
          </p>
        )}
      </section>

      <p className="mt-8 text-center text-xs text-muted">
        PCB Scouting List · all data stored privately on this device.
      </p>
    </div>
  )
}

function summarize({ added, enriched }: SyncResult): string {
  if (added === 0 && enriched === 0) return 'You’re up to date — nothing new.'
  const parts: string[] = []
  if (added) parts.push(`${added} new place${added === 1 ? '' : 's'} added`)
  if (enriched) parts.push(`${enriched} refreshed`)
  return parts.join(' · ')
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-sand px-2 py-2">
      <div className="font-display text-2xl text-ink">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}

function ActionRow({
  Icon,
  title,
  subtitle,
  button,
  onClick,
  disabled,
}: {
  Icon: typeof RefreshCw
  title: string
  subtitle: string
  button: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-coastal-sm)]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-card)] bg-seafoam/15">
        <Icon size={20} strokeWidth={2} className="text-seafoam" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-ink">{title}</div>
        <p className="text-sm text-muted">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="shrink-0 rounded-[var(--radius-pill)] bg-coral px-4 py-2 text-sm font-semibold text-surface transition-transform active:scale-95 disabled:bg-line disabled:text-muted"
      >
        {button}
      </button>
    </div>
  )
}
