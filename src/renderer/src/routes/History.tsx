import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANDS, CATEGORIES } from '@shared/types'
import type { Product, ProductImage, ProductFilter } from '@shared/types'

type ProductWithThumb = Product & { thumbnail_path?: string }
type ViewMode = 'list' | 'grid'

function useThumbnail(path?: string): string | null {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    if (!path) return
    let cancelled = false
    window.api.readImage(path).then((d) => {
      if (d && !cancelled) setSrc(d)
    })
    return () => { cancelled = true }
  }, [path])
  return src
}

function ThumbnailImage({ path, size = 'md' }: { path?: string; size?: 'sm' | 'md' | 'lg' }): JSX.Element {
  const src = useThumbnail(path)
  const sizeClass = size === 'sm' ? 'w-10 h-10' : size === 'lg' ? 'w-full h-36' : 'w-14 h-14'
  const roundClass = size === 'lg' ? 'rounded-lg' : 'rounded-lg'

  if (!path) {
    return (
      <div className={`${sizeClass} ${roundClass} bg-surface-3 flex items-center justify-center shrink-0`}>
        <svg className="w-4 h-4 text-txt-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
        </svg>
      </div>
    )
  }

  return src ? (
    <img src={src} className={`${sizeClass} ${roundClass} object-cover shrink-0`} />
  ) : (
    <div className={`${sizeClass} ${roundClass} bg-surface-3 animate-pulse shrink-0`} />
  )
}

function buildDescription(p: Product): string {
  const parts: string[] = []
  if (p.color) parts.push(p.color)
  if (p.material) parts.push(p.material)
  if (p.size) parts.push(`サイズ: ${p.size}`)
  if (p.notes) parts.push(p.notes)
  return parts.join(' / ') || '詳細情報なし'
}

export default function History(): JSX.Element {
  const navigate = useNavigate()
  const [products, setProducts] = useState<ProductWithThumb[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ProductFilter>({ page: 1, limit: 20 })
  const [brandFilter, setBrandFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<{ product: Product; images: ProductImage[] } | null>(null)
  const [detailImages, setDetailImages] = useState<Record<number, string>>({})
  const [detailLoading, setDetailLoading] = useState(false)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const f: ProductFilter = { ...filter }
      if (brandFilter) f.brand = brandFilter
      if (categoryFilter) f.category = categoryFilter
      const data = await window.api.getProducts(f)
      setProducts(data.products)
      setTotal(data.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [filter, brandFilter, categoryFilter])

  useEffect(() => { loadProducts() }, [loadProducts])

  const handleRowClick = async (p: Product): Promise<void> => {
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
  }

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

  const totalPages = Math.ceil(total / (filter.limit || 20))
  const currentPage = filter.page || 1

  const FIELD_LABELS: Record<string, string> = {
    brand: 'ブランド', category: 'カテゴリ', model: '型番', size: 'サイズ',
    color: '色', material: '素材', condition: '状態', price: '買取価格', notes: '備考'
  }

  return (
    <div className="flex-1 flex overflow-hidden" data-testid="history-page">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 pt-5 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-bold text-txt-primary">買取履歴</h1>
              <p data-testid="history-total" className="text-xs text-txt-tertiary">{total}件の買取データ</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 bg-surface-2 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-surface-0 shadow-sm text-txt-primary' : 'text-txt-muted hover:text-txt-secondary'}`}
                  title="リスト表示"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-surface-0 shadow-sm text-txt-primary' : 'text-txt-muted hover:text-txt-secondary'}`}
                  title="グリッド表示"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zm9.75-9.75A2.25 2.25 0 0115.75 3.75H18a2.25 2.25 0 012.25 2.25v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 15.75V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                </button>
              </div>
              <button onClick={() => navigate('/workspace')} className="btn-primary text-xs py-1.5 px-3">
                新規買取
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              data-testid="brand-filter"
              type="text" placeholder="ブランド検索" value={brandFilter}
              onChange={e => setBrandFilter(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setFilter(p => ({ ...p, page: 1 }))}
              className="input-field max-w-[200px] text-xs" list="hist-brands"
            />
            <datalist id="hist-brands">{BRANDS.map(b => <option key={b} value={b} />)}</datalist>
            <select data-testid="category-filter" value={categoryFilter}
              onChange={e => { setCategoryFilter(e.target.value); setFilter(p => ({ ...p, page: 1 })) }}
              className="input-field max-w-[140px] text-xs">
              <option value="">全カテゴリ</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {(brandFilter || categoryFilter) && (
              <button data-testid="filter-clear" onClick={() => { setBrandFilter(''); setCategoryFilter(''); setFilter({ page: 1, limit: 20 }) }}
                className="btn-ghost text-2xs text-txt-muted">クリア</button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {loading ? (
            <div data-testid="history-loading" className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <div className="skeleton w-14 h-14 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-3 w-40 rounded" />
                    <div className="skeleton h-2.5 w-24 rounded" />
                    <div className="skeleton h-2 w-56 rounded" />
                  </div>
                  <div className="skeleton h-3 w-20 rounded" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div data-testid="empty-state" className="text-center py-16 text-sm text-txt-muted">
              {brandFilter || categoryFilter ? '条件に合うデータがありません' : '買取データがありません'}
            </div>
          ) : viewMode === 'list' ? (
            <div data-testid="history-table" className="card divide-y divide-border-subtle">
              {products.map(p => (
                <div
                  key={p.id}
                  data-testid="history-row"
                  data-product-id={p.id}
                  className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors ${
                    selectedId === p.id ? 'bg-accent-muted' : 'hover:bg-surface-3/50'
                  }`}
                  onClick={() => handleRowClick(p)}
                >
                  <ThumbnailImage path={p.thumbnail_path} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-txt-primary">{p.brand}</span>
                      <span className="badge-info">{p.category}</span>
                      <span className="text-2xs text-txt-muted">{p.condition}ランク</span>
                    </div>
                    <p className="text-xs text-txt-secondary truncate">{p.model || '型番未設定'}</p>
                    <p className="text-2xs text-txt-muted truncate mt-0.5">{buildDescription(p)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-txt-primary tabular-nums">¥{p.price.toLocaleString()}</p>
                    <p className="text-2xs text-txt-muted mt-0.5">
                      {new Date(p.created_at).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div data-testid="history-grid" className="grid grid-cols-2 gap-3">
              {products.map(p => (
                <div
                  key={p.id}
                  data-testid="history-row"
                  data-product-id={p.id}
                  className={`card overflow-hidden cursor-pointer transition-all ${
                    selectedId === p.id ? 'ring-2 ring-accent' : 'hover:ring-1 hover:ring-border-accent'
                  }`}
                  onClick={() => handleRowClick(p)}
                >
                  <ThumbnailImage path={p.thumbnail_path} size="lg" />
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-txt-primary truncate">{p.brand}</span>
                      <span className="badge-info text-2xs">{p.category}</span>
                    </div>
                    <p className="text-xs text-txt-secondary truncate">{p.model || '型番未設定'}</p>
                    <p className="text-2xs text-txt-muted truncate mt-0.5">{buildDescription(p)}</p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-subtle">
                      <span className="text-2xs text-txt-muted">
                        {new Date(p.created_at).toLocaleDateString('ja-JP')}
                      </span>
                      <span className="text-sm font-semibold text-txt-primary tabular-nums">
                        ¥{p.price.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button data-testid="page-prev" onClick={() => setFilter(p => ({ ...p, page: currentPage - 1 }))}
                disabled={currentPage <= 1} className="btn-ghost text-xs disabled:opacity-30">前へ</button>
              <span data-testid="page-info" className="text-xs text-txt-muted tabular-nums">{currentPage} / {totalPages}</span>
              <button data-testid="page-next" onClick={() => setFilter(p => ({ ...p, page: currentPage + 1 }))}
                disabled={currentPage >= totalPages} className="btn-ghost text-xs disabled:opacity-30">次へ</button>
            </div>
          )}
        </div>
      </div>

      {selectedId !== null && (
        <div data-testid="detail-panel" className="w-[380px] border-l border-border bg-surface-1 shrink-0 flex flex-col overflow-hidden animate-fade-in">
          <div className="pane-header">
            <span className="text-xs font-semibold text-txt-secondary uppercase tracking-wider">商品詳細</span>
            <button data-testid="detail-close" onClick={() => { setSelectedId(null); setDetail(null); setDetailImages({}) }}
              className="btn-ghost p-1 rounded">
              <svg className="w-4 h-4 text-txt-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {detailLoading ? (
              <div data-testid="detail-loading" className="space-y-3">
                <div className="skeleton h-40 w-full rounded-lg" />
                <div className="skeleton h-4 w-32 rounded" />
                <div className="skeleton h-3 w-48 rounded" />
                <div className="skeleton h-3 w-24 rounded" />
              </div>
            ) : detail ? (
              <div data-testid="detail-content" className="space-y-4">
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
                      <div key={key} data-testid={`detail-field-${key}`}>
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
