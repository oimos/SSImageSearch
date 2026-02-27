import { useNavigate } from 'react-router-dom'
import { useRecentProducts } from '../hooks/useProducts'
import { useSearchFlow } from '../contexts/SearchFlowContext'
import { useState, useEffect } from 'react'

export default function Home(): JSX.Element {
  const navigate = useNavigate()
  const { products, loading } = useRecentProducts(8)
  const { reset } = useSearchFlow()
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    window.api.getProductCount().then(setTotalCount)
  }, [])

  return (
    <div className="page-content flex items-center justify-center">
      <div className="max-w-2xl w-full px-6">
        <div className="text-center mb-12">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h1 data-testid="home-title" className="text-2xl font-bold text-txt-primary mb-2">買取類似検索</h1>
          <p className="text-sm text-txt-tertiary">画像ドロップで始めよう。類似候補から1タップで入力完了。</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-10">
          <button
            data-testid="new-purchase-btn"
            onClick={() => { reset(); navigate('/workspace') }}
            className="card-interactive p-5 text-left group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                <svg className="w-4.5 h-4.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-txt-primary">新規買取</h2>
                <p className="text-2xs text-txt-tertiary">画像から候補を検索</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="kbd">⌘N</span>
            </div>
          </button>

          <button
            data-testid="history-btn"
            onClick={() => navigate('/history')}
            className="card-interactive p-5 text-left group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                <svg className="w-4.5 h-4.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-txt-primary">買取履歴</h2>
                <p data-testid="history-count" className="text-2xs text-txt-tertiary">{totalCount}件のデータ</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="kbd">⌘H</span>
            </div>
          </button>
        </div>

        {products.length > 0 && (
          <div data-testid="recent-products">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-txt-tertiary uppercase tracking-wider">直近の買取</h2>
              <button onClick={() => navigate('/history')} className="text-2xs text-accent-text hover:text-accent">
                すべて表示
              </button>
            </div>
            <div className="space-y-1">
              {products.map(p => (
                <div
                  key={p.id}
                  data-testid="recent-product-item"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 cursor-pointer transition-colors group"
                  onClick={() => navigate('/workspace')}
                >
                  <div className="w-7 h-7 rounded bg-surface-3 flex items-center justify-center shrink-0">
                    <span className="text-2xs font-bold text-txt-muted">{p.brand.slice(0, 2)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-txt-primary font-medium truncate block">
                      {p.brand} <span className="text-txt-muted">·</span> {p.model}
                    </span>
                  </div>
                  <span className="text-2xs text-txt-muted shrink-0">{p.category}</span>
                  <span className="text-xs text-txt-secondary font-medium tabular-nums shrink-0">
                    ¥{p.price.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div data-testid="home-loading" className="space-y-2">
            {[1,2,3].map(i => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                <div className="skeleton w-7 h-7 rounded" />
                <div className="skeleton h-3 w-40 rounded" />
                <div className="skeleton h-3 w-16 rounded ml-auto" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
