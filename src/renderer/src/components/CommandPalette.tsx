import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

interface Command {
  id: string
  label: string
  shortcut?: string
  action: () => void
  group: string
}

export default function CommandPalette(): JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const commands: Command[] = [
    { id: 'new', label: '新規買取登録', shortcut: '⌘N', group: 'ナビゲーション', action: () => { navigate('/workspace'); setOpen(false) } },
    { id: 'history', label: '買取履歴を開く', shortcut: '⌘H', group: 'ナビゲーション', action: () => { navigate('/history'); setOpen(false) } },
    { id: 'home', label: 'ホームに戻る', group: 'ナビゲーション', action: () => { navigate('/'); setOpen(false) } }
  ]

  const filtered = query
    ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
        setQuery('')
        setSelectedIdx(0)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIdx]) {
      filtered[selectedIdx].action()
    }
  }, [filtered, selectedIdx])

  if (!open) return <></>

  return (
    <div data-testid="command-palette" className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-[520px] bg-surface-2 border border-border rounded-xl shadow-2xl overflow-hidden animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <svg className="w-4 h-4 text-txt-tertiary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            data-testid="command-input"
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0) }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-txt-primary placeholder-txt-muted outline-none"
            placeholder="コマンドを検索..."
          />
          <span className="kbd">Esc</span>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-txt-muted">
              該当するコマンドがありません
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                data-testid={`command-item-${cmd.id}`}
                onClick={cmd.action}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  i === selectedIdx ? 'bg-accent-muted text-accent-text' : 'text-txt-secondary hover:bg-surface-3'
                }`}
              >
                <span>{cmd.label}</span>
                {cmd.shortcut && <span className="kbd">{cmd.shortcut}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
