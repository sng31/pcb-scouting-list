import { useRef, useState } from 'react'
import { RefreshCw, Download, Upload, RotateCcw } from 'lucide-react'
import { useStore, selectCounts } from '../store'
import type { SyncResult } from '../store'
import type { Item } from '../types'

export default function Settings() {
  const items = useStore((s) => s.items)
  const lastSyncedAt = useStore((s) => s.lastSyncedAt)
  const syncFromSeed = useStore((s) => s.syncFromSeed)
  const importData = useStore((s) => s.importData)
  const resetToSeed = useStore((s) => s.resetToSeed)
  const counts = selectCounts(items)
  const placeCount = items.filter((it) => it.category !== 'task').length

  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [importMsg, setImportMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function checkForNewPlaces() {
    const r: SyncResult = syncFromSeed()
    setSyncMsg(summarize(r))
  }

  function handleExport() {
    const state = useStore.getState()
    const payload = { version: state.version, items: state.items, seededAt: state.seededAt }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pcb-scouting-list-backup.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!fileInputRef.current) return
    fileInputRef.current.value = ''
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        if (!Array.isArray(parsed?.items)) throw new Error('Invalid backup file.')
        const n = (parsed.items as Item[]).length
        if (
          !confirm(
            `Replace all your current data with this backup?\n\n${n} places will be loaded. This can't be undone.`,
          )
        )
          return
        importData(parsed)
        setImportMsg({ text: `Imported ${n} places.`, ok: true })
      } catch {
        setImportMsg({ text: 'Could not read that file — is it a valid backup?', ok: false })
      }
    }
    reader.readAsText(file)
  }

  function handleReset() {
    if (
      confirm(
        'Reset everything back to the original seed data?\n\nYour ratings, notes, favorites, and any places you added will be lost.',
      )
    ) {
      resetToSeed()
      setImportMsg({ text: 'Reset to original seed data.', ok: true })
    }
  }

  return (
    <div className="px-5 py-6">
      <h1 className="text-2xl text-ink">Settings</h1>

      {/* data summary */}
      <section className="mt-5 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-coastal-sm)]">
        <h2 className="text-sm font-semibold text-muted">Your list</h2>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <Mini label="Places" value={placeCount} />
          <Mini label="Been" value={counts.been} />
          <Mini label="Favorites" value={counts.favorites} />
        </div>
        {lastSyncedAt && (
          <p className="mt-3 text-xs text-muted">
            Last checked: {new Date(lastSyncedAt).toLocaleString()}
          </p>
        )}
      </section>

      {/* keep it fresh */}
      <section className="mt-6">
        <h2 className="mb-3 text-xl text-ink">Keep it fresh</h2>
        <ActionRow
          Icon={RefreshCw}
          title="Check for new places"
          subtitle="Pull newly added spots and refresh excursion details. Your ratings, notes, and favorites are kept."
          button="Check now"
          onClick={checkForNewPlaces}
        />
        {syncMsg && (
          <p className="mt-2 rounded-[var(--radius-card)] bg-seafoam/15 px-4 py-2.5 text-sm font-semibold text-seafoam">
            {syncMsg}
          </p>
        )}
      </section>

      {/* data safety */}
      <section className="mt-6">
        <h2 className="mb-3 text-xl text-ink">Data safety</h2>
        <div className="space-y-3">
          <ActionRow
            Icon={Download}
            title="Export backup"
            subtitle="Download all your data as a JSON file you can restore from later."
            button="Export"
            onClick={handleExport}
          />

          <ActionRow
            Icon={Upload}
            title="Import backup"
            subtitle="Restore from a previously exported backup. Replaces all current data."
            button="Import"
            onClick={() => fileInputRef.current?.click()}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={handleImportFile}
          />

          <ActionRow
            Icon={RotateCcw}
            title="Reset to seed data"
            subtitle="Wipe everything and reload the original bundled places. Your edits will be lost."
            button="Reset"
            onClick={handleReset}
            danger
          />
        </div>

        {importMsg && (
          <p
            className={`mt-3 rounded-[var(--radius-card)] px-4 py-2.5 text-sm font-semibold ${
              importMsg.ok ? 'bg-seafoam/15 text-seafoam' : 'bg-coral/15 text-coral'
            }`}
          >
            {importMsg.text}
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
  if (added === 0 && enriched === 0) return "You're up to date — nothing new."
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
  danger,
}: {
  Icon: typeof RefreshCw
  title: string
  subtitle: string
  button: string
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-coastal-sm)]">
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-card)] ${danger ? 'bg-coral/15' : 'bg-seafoam/15'}`}
      >
        <Icon size={20} strokeWidth={2} className={danger ? 'text-coral' : 'text-seafoam'} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-ink">{title}</div>
        <p className="text-sm text-muted">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`shrink-0 rounded-[var(--radius-pill)] px-4 py-2 text-sm font-semibold text-surface transition-transform active:scale-95 disabled:bg-line disabled:text-muted ${danger ? 'bg-coral/70' : 'bg-coral'}`}
      >
        {button}
      </button>
    </div>
  )
}
