import type { ConfidenceLevel } from '@shared/types'
import { CONFIDENCE_LABELS } from '@shared/types'

interface ConfidenceBadgeProps {
  confidence: number
  level?: ConfidenceLevel
  isApplied?: boolean
}

const LEVEL_STYLES: Record<ConfidenceLevel, string> = {
  high: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  medium: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  low: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  weak: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
}

export default function ConfidenceBadge({
  confidence,
  level,
  isApplied = false
}: ConfidenceBadgeProps): JSX.Element {
  if (isApplied) {
    return (
      <span className="badge-info">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        適用済
      </span>
    )
  }

  const pct = Math.round(confidence * 100)
  const resolvedLevel: ConfidenceLevel =
    level ?? (pct >= 85 ? 'high' : pct >= 70 ? 'medium' : pct >= 50 ? 'low' : 'weak')

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium border ${LEVEL_STYLES[resolvedLevel]}`}
    >
      {CONFIDENCE_LABELS[resolvedLevel]}
      <span className="tabular-nums opacity-75">{pct}%</span>
    </span>
  )
}
