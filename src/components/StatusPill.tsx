import { Check, Bookmark } from 'lucide-react'
import type { Category, Status } from '../types'
import { statusLabel } from '../types'

// "Want to try" / "Been" pill (or "To do" / "Done" for tasks).
export default function StatusPill({
  status,
  category,
}: {
  status: Status
  category: Category
}) {
  const been = status === 'been'
  const Icon = been ? Check : Bookmark
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-semibold ${
        been ? 'bg-seafoam/20 text-seafoam' : 'bg-coral/15 text-coral'
      }`}
    >
      <Icon size={13} strokeWidth={2.4} />
      {statusLabel(status, category)}
    </span>
  )
}
