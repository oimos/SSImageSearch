interface ConfidenceBadgeProps {
  confidence: number
  isApplied?: boolean
}

export default function ConfidenceBadge({
  confidence,
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

  if (pct >= 80) return <span className="badge-success">高信頼 {pct}%</span>
  if (pct >= 50) return <span className="badge-warning">中信頼 {pct}%</span>
  return <span className="badge-danger">要確認 {pct}%</span>
}
