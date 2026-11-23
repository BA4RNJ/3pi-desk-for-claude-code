import { diffLines } from 'diff'
import { useMemo } from 'react'

const PREVIEW_LIMIT = 200_000

export function DiffView({
  before,
  after,
  compact = false
}: {
  before: string
  after: string
  compact?: boolean
}) {
  const truncated = before.length > PREVIEW_LIMIT || after.length > PREVIEW_LIMIT
  const parts = useMemo(
    () =>
      diffLines(before.slice(0, PREVIEW_LIMIT), after.slice(0, PREVIEW_LIMIT)),
    [before, after]
  )
  if (!before && !after) {
    return <p className="diff-empty">没有可预览的内容。</p>
  }
  return (
    <div className={`diff-view ${compact ? 'is-compact' : ''}`}>
      {truncated && <p className="diff-empty">改动过大，仅显示前 200 KB。</p>}
      {parts.map((part, index) => {
        const lines = part.value.replace(/\n$/, '').split('\n')
        const className = part.added ? 'diff-add' : part.removed ? 'diff-del' : 'diff-same'
        const sign = part.added ? '+' : part.removed ? '−' : ' '
        return (
          <div key={index} className={className}>
            {lines.map((line, lineIndex) => (
              <div className="diff-line" key={lineIndex}>
                <span className="diff-sign">{sign}</span>
                <span>{line || ' '}</span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
