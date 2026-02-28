import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'

export default function Layout(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const { resolved, toggle } = useTheme()

  const navItems = [
    { path: '/workspace', label: '買取登録', shortcut: 'N', icon: 'M12 4v16m8-8H4', testId: 'nav-workspace' },
    { path: '/history', label: '履歴', shortcut: 'H', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', testId: 'nav-history' }
  ]

  return (
    <div className="page-container">
      <header className="drag-region h-11 bg-surface-1 border-b border-border flex items-center shrink-0 pl-[78px] pr-4">
        <div className="no-drag flex items-center gap-1 mr-auto">
          <button
            data-testid="nav-home"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-surface-3 transition-colors"
          >
            <div className="w-5 h-5 bg-accent rounded flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-txt-secondary">SS Image Search</span>
          </button>

          <span className="text-txt-muted mx-1">/</span>

          {navItems.map((item) => {
            const active = location.pathname === item.path
            return (
              <button
                key={item.path}
                data-testid={item.testId}
                onClick={() => navigate(item.path)}
                className={`no-drag flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  active
                    ? 'bg-surface-3 text-txt-primary'
                    : 'text-txt-tertiary hover:text-txt-secondary hover:bg-surface-3'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {item.label}
                <span className="kbd ml-0.5 opacity-60">
                  {navigator.platform.includes('Mac') ? '⌘' : '⌃'}{item.shortcut}
                </span>
              </button>
            )
          })}
        </div>

        <div className="no-drag flex items-center gap-2">
          <button
            data-testid="theme-toggle"
            onClick={toggle}
            className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-surface-3 text-txt-tertiary hover:text-txt-secondary transition-colors"
            title={resolved === 'dark' ? 'ライトモードに切替' : 'ダークモードに切替'}
          >
            {resolved === 'dark' ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          <button
            data-testid="search-trigger"
            onClick={() => {
              const evt = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })
              document.dispatchEvent(evt)
            }}
            className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-surface-2 border border-border hover:border-border-accent text-txt-tertiary text-xs transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            検索
            <span className="kbd">{navigator.platform.includes('Mac') ? '⌘' : '⌃'}K</span>
          </button>
        </div>
      </header>

      <Outlet />
    </div>
  )
}
