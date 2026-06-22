import { MapPin } from 'lucide-react'
import type { Area } from '../types'
import { AREA_LABEL } from '../types'

export default function AreaChip({ area }: { area: Area }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-sky/25 px-2.5 py-1 text-xs font-semibold text-ink">
      <MapPin size={12} strokeWidth={2.2} />
      {AREA_LABEL[area]}
    </span>
  )
}
