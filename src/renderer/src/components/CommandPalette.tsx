import { Command, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

export interface CommandPaletteAction {
  id: string
  label: string
  hint?: string
  run: () => void
}

interface CommandPaletteProps {
  actions: CommandPaletteAction[]
  onClose: () => void
}

export function CommandPalette({ actions, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return actions
    return actions.filter(
      (action) =>
        action.label.toLowerCase().includes(term) ||
        (action.hint || '').toLowerCase().includes(term)
    )
  }, [actions, query])

  useEffect(() => {
    inputRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    setSelected(0)
  }, [query])

  const run = (action: CommandPaletteAction): void => {
    onClose()
    action.run()
  }

  return (
    <div className="modal-backdrop command-palette-backdrop" role="presentation">
      <div className="command-palette" role="dialog" aria-modal="true" aria-label="命令面板">
        <div className="command-palette-input">
          <Search size={16} />
          <input
            ref={inputRef}
            value={query}
            placeholder="输入命令…"
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setSelected((index) => Math.min(filtered.length - 1, index + 1))
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setSelected((index) => Math.max(0, index - 1))
              }
              if (event.key === 'Enter' && filtered[selected]) {
                event.preventDefault()
                run(filtered[selected])
              }
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="command-palette-list">
          {filtered.length === 0 && (
            <p className="settings-empty">没有匹配的命令。</p>
          )}
          {filtered.map((action, index) => (
            <button
              key={action.id}
              type="button"
              className={`command-palette-item ${index === selected ? 'is-selected' : ''}`}
              onMouseEnter={() => setSelected(index)}
              onClick={() => run(action)}
            >
              <Command size={13} />
              <span>{action.label}</span>
              {action.hint && <em>{action.hint}</em>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
