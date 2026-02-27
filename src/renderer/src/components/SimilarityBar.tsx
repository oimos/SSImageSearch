interface SimilarityBarProps {
  score: number
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export default function SimilarityBar({
  score,
  showLabel = true,
  size = 'md'
}: SimilarityBarProps): JSX.Element {
  const pct = Math.round(score * 100)

  const getColor = (): string => {
    if (pct >= 80) return 'bg-emerald-400'
    if (pct >= 60) return 'bg-amber-400'
    if (pct >= 40) return 'bg-orange-400'
    return 'bg-red-400'
  }

  const getTextColor = (): string => {
    if (pct >= 80) return 'text-emerald-400'
    if (pct >= 60) return 'text-amber-400'
    if (pct >= 40) return 'text-orange-400'
    return 'text-red-400'
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex-1 bg-surface-3 rounded-full overflow-hidden ${size === 'sm' ? 'h-1' : 'h-1.5'}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${getColor()}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className={`text-xs font-semibold tabular-nums min-w-[3rem] text-right ${getTextColor()}`}>
          {pct}%
        </span>
      )}
    </div>
  )
}
