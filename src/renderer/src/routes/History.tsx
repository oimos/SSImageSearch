import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANDS, CATEGORIES, IMAGE_TYPE_LABELS } from '@shared/types'
import type { Product, ProductImage, ProductFilter } from '@shared/types'

export default function History(): JSX.Element {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ProductFilter>({ page: 1, limit: 20 })
  const [brandFilter, setBrandFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

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
              <p data-testid="history-total" className="text-xs text-txt-tertiary">{total}件</p>
            </div>
            <button onClick={() => navigate('/workspace')} className="btn-primary text-xs py-1.5 px-3">
              新規買取
            </button>
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
                  <div className="skeleton w-10 h-10 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-3 w-40 rounded" />
                    <div className="skeleton h-2.5 w-24 rounded" />
                  </div>
                  <div className="skeleton h-3 w-20 rounded" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div data-testid="empty-state" className="text-center py-16 text-sm text-txt-muted">
              {brandFilter || categoryFilter ? '条件に合うデータがありません' : '買取データがありません'}
            </div>
          ) : (
            <div data-testid="history-table" className="card">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {['日付', 'ブランド', 'カテゴリ', '型番', '状態', '価格'].map(h => (
                      <th key={h} className="text-left text-2xs font-medium text-txt-muted px-4 py-2.5 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}
                      data-testid="history-row"
                      data-product-id={p.id}
                      className={`border-b border-border-subtle cursor-pointer transition-colors ${
                        selectedId === p.id ? 'bg-accent-muted' : 'hover:bg-surface-3/50'
                      }`}
                      onClick={() => handleRowClick(p)}>
                      <td className="px-4 py-2.5 text-xs text-txt-tertiary tabular-nums">
                        {new Date(p.created_at).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-medium text-txt-primary">{p.brand}</td>
                      <td className="px-4 py-2.5"><span className="badge-info">{p.category}</span></td>
                      <td className="px-4 py-2.5 text-xs text-txt-secondary max-w-[200px] truncate">{p.model}</td>
                      <td className="px-4 py-2.5 text-xs text-txt-tertiary">{p.condition}</td>
                      <td className="px-4 py-2.5 text-xs font-medium text-txt-primary tabular-nums text-right">
                        ¥{p.price.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                {detail.images.length > 0 && (
                  <div className="space-y-2">
                    {detail.images.map(img => (
                      <div key={img.id} className="relative rounded-lg overflow-hidden border border-border bg-surface-2">
                        {detailImages[img.id] ? (
                          <img src={detailImages[img.id]} alt={img.image_type} className="w-full h-40 object-cover" />
                        ) : (
                          <div className="w-full h-40 flex items-center justify-center bg-surface-3">
                            <span className="text-2xs text-txt-muted">読み込み中...</span>
                          </div>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                          <span className="text-2xs text-white/80 font-medium">
                            {IMAGE_TYPE_LABELS[img.image_type] || img.image_type}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {detail.images.length === 0 && (
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
