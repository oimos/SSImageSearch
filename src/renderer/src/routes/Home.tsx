import { useNavigate } from 'react-router-dom'
import { useRecentProducts } from '../hooks/useProducts'
import { useSearchFlow } from '../contexts/SearchFlowContext'
import { useState, useEffect, useCallback } from 'react'
import type { Product, ProductImage } from '@shared/types'

const FIELD_LABELS: Record<string, string> = {
  brand: 'ブランド', category: 'カテゴリ', model: '型番', size: 'サイズ',
  color: '色', material: '素材', condition: '状態', price: '買取価格', notes: '備考'
}

export default function Home(): JSX.Element {
  const navigate = useNavigate()
  const { products, loading } = useRecentProducts(12)
  const { reset } = useSearchFlow()
  const [totalCount, setTotalCount] = useState(0)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<{ product: Product; images: ProductImage[] } | null>(null)
  const [detailImages, setDetailImages] = useState<Record<number, string>>({})
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    window.api.getProductCount().then(setTotalCount)
  }, [])

  const handleRowClick = useCallback(async (p: Product) => {
    if (selectedId === p.id) {
      setSelectedId(null)
      setDetail(null)
      setDetailImages({})
      return
    }
    setSelectedId(p.id)
    setDetailLoading(true)
    try {
      const data = await window.api.getProduct(p.id)
      if (data) {
        setDetail({ product: data.product, images: data.images })
        const imgs: Record<number, string> = {}
        for (const img of data.images) {
          try {
            const b64 = await window.api.readImage(img.image_path)
            if (b64) imgs[img.id] = b64
          } catch { /* skip */ }
        }
        setDetailImages(imgs)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDetailLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && selectedId !== null) {
        setSelectedId(null)
        setDetail(null)
        setDetailImages({})
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedId])

  const todayStr = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  }).format(new Date())

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6">
          {/* Header row */}
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-2xs text-txt-muted mb-0.5">{todayStr}</p>
              <h1 data-testid="home-title" className="text-lg font-semibold text-txt-primary tracking-tight">
                買取ダッシュボード
              </h1>
            </div>
            <button
              data-testid="new-purchase-btn"
              onClick={() => { reset(); navigate('/workspace') }}
              className="btn-primary flex items-center gap-2 text-xs py-2 px-4"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              新規買取
              <span className="kbd text-[10px] bg-white/15 border-white/20 text-white/70 ml-1">⌘N</span>
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="px-4 py-3 rounded-lg bg-surface-1 border border-border">
              <p className="text-2xs text-txt-muted mb-0.5">登録商品数</p>
              <p data-testid="history-count" className="text-xl font-semibold text-txt-primary tabular-nums">{totalCount}</p>
            </div>
            <div className="px-4 py-3 rounded-lg bg-surface-1 border border-border">
              <p className="text-2xs text-txt-muted mb-0.5">直近登録</p>
              <p className="text-xl font-semibold text-txt-primary tabular-nums">
                {products.length > 0
                  ? new Intl.DateTimeFormat('ja-JP', { month: 'short', day: 'numeric' }).format(new Date(products[0].created_at))
                  : '—'
                }
              </p>
            </div>
            <button
              data-testid="history-btn"
              onClick={() => navigate('/history')}
              className="px-4 py-3 rounded-lg bg-surface-1 border border-border text-left hover:bg-surface-2 hover:border-border-accent transition-colors group"
            >
              <p className="text-2xs text-txt-muted mb-0.5">履歴を表示</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-accent-text group-hover:text-accent transition-colors">
                  全件一覧
                </p>
                <svg className="w-3.5 h-3.5 text-txt-muted group-hover:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          </div>

          {/* Recent products table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-txt-tertiary uppercase tracking-wider">直近の買取</h2>
              {products.length > 0 && (
                <button onClick={() => navigate('/history')} className="text-2xs text-accent-text hover:text-accent transition-colors">
                  すべて →
                </button>
              )}
            </div>

            {loading && (
              <div data-testid="home-loading" className="space-y-px">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-center gap-4 px-3 py-2.5">
                    <div className="skeleton w-6 h-6 rounded" />
                    <div className="skeleton h-3 w-24 rounded" />
                    <div className="skeleton h-3 w-32 rounded" />
                    <div className="skeleton h-3 w-14 rounded ml-auto" />
                    <div className="skeleton h-3 w-16 rounded" />
                  </div>
                ))}
              </div>
            )}

            {!loading && products.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-sm text-txt-muted mb-3">商品データがありません</p>
                <button
                  onClick={() => { reset(); navigate('/workspace') }}
                  className="text-xs text-accent-text hover:text-accent transition-colors"
                >
                  最初の買取を登録する →
                </button>
              </div>
            )}

            {products.length > 0 && (
              <div data-testid="recent-products" className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-[2fr_2fr_1fr_1fr_80px] gap-2 px-3 py-2 bg-surface-1 border-b border-border text-2xs font-medium text-txt-muted uppercase tracking-wider">
                  <span>ブランド</span>
                  <span>モデル</span>
                  <span>カテゴリ</span>
                  <span>コンディション</span>
                  <span className="text-right">価格</span>
                </div>
                {products.map((p, idx) => (
                  <div
                    key={p.id}
                    data-testid="recent-product-item"
                    className={`grid grid-cols-[2fr_2fr_1fr_1fr_80px] gap-2 px-3 py-2.5 cursor-pointer transition-colors group ${
                      selectedId === p.id ? 'bg-accent-muted' : 'hover:bg-surface-2'
                    } ${idx < products.length - 1 ? 'border-b border-border-subtle' : ''}`}
                    onClick={() => handleRowClick(p)}
                  >
                    <span className="text-xs font-medium text-txt-primary truncate">{p.brand}</span>
                    <span className="text-xs text-txt-secondary truncate">{p.model || '—'}</span>
                    <span className="text-xs text-txt-tertiary">{p.category}</span>
                    <span className="text-xs text-txt-tertiary">{p.condition || '—'}</span>
                    <span className="text-xs text-txt-primary font-medium tabular-nums text-right">
                      ¥{p.price.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selectedId !== null && (
        <div data-testid="home-detail-panel" className="w-[360px] border-l border-border bg-surface-1 shrink-0 flex flex-col overflow-hidden">
          <div className="pane-header">
            <span className="text-xs font-semibold text-txt-secondary uppercase tracking-wider">商品詳細</span>
            <button
              onClick={() => { setSelectedId(null); setDetail(null); setDetailImages({}) }}
              className="btn-ghost p-1 rounded"
            >
              <svg className="w-4 h-4 text-txt-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {detailLoading ? (
              <div className="space-y-3">
                <div className="skeleton h-40 w-full rounded-lg" />
                <div className="skeleton h-4 w-32 rounded" />
                <div className="skeleton h-3 w-48 rounded" />
                <div className="skeleton h-3 w-24 rounded" />
              </div>
            ) : detail ? (
              <div className="space-y-4">
                {detail.images.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {detail.images.map(img => (
                      <div key={img.id} className="rounded-lg overflow-hidden border border-border bg-surface-2">
                        {detailImages[img.id] ? (
                          <img src={detailImages[img.id]} alt="" className="w-full h-28 object-cover" />
                        ) : (
                          <div className="w-full h-28 flex items-center justify-center bg-surface-3 animate-pulse">
                            <span className="text-2xs text-txt-muted">...</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-surface-2 h-32 flex items-center justify-center">
                    <span className="text-xs text-txt-muted">画像なし</span>
                  </div>
                )}

                <div className="space-y-2.5">
                  {Object.entries(FIELD_LABELS).map(([key, label]) => {
                    const val = detail.product[key as keyof Product]
                    if (val === undefined || val === null || val === '') return null
                    return (
                      <div key={key}>
                        <dt className="text-2xs font-medium text-txt-muted uppercase tracking-wider mb-0.5">{label}</dt>
                        <dd className="text-sm text-txt-primary">
                          {key === 'price' ? `¥${Number(val).toLocaleString()}` : key === 'condition' ? `${val}ランク` : String(val)}
                        </dd>
                      </div>
                    )
                  })}
                  <div>
                    <dt className="text-2xs font-medium text-txt-muted uppercase tracking-wider mb-0.5">登録日</dt>
                    <dd className="text-sm text-txt-primary">
                      {new Date(detail.product.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </dd>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-txt-muted">データを読み込めませんでした</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
