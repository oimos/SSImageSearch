import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchFlow } from '../contexts/SearchFlowContext'
import { useSearch } from '../hooks/useSearch'
import { fileToBase64, generateEmbedding } from '../lib/embedding'
import type { ImageType, UploadedImage, ProductFormData, SearchResult } from '@shared/types'
import { IMAGE_TYPE_LABELS, BRANDS, CATEGORIES, CONDITIONS } from '@shared/types'
import ConfidenceBadge from '../components/ConfidenceBadge'

const EMPTY_FORM: ProductFormData = {
  brand: '', category: '', model: '', size: '', color: '',
  material: '', condition: 'B', price: 0, notes: ''
}

type WorkspacePhase = 'idle' | 'searching' | 'results' | 'saving' | 'saved'

export default function Workspace(): JSX.Element {
  const { uploadedImages, setUploadedImages, searchResults, setSearchResults, reset } = useSearchFlow()
  const { loading, progress, searchByImages } = useSearch()

  const [phase, setPhase] = useState<WorkspacePhase>('idle')
  const [formData, setFormData] = useState<ProductFormData>({ ...EMPTY_FORM })
  const [appliedFields, setAppliedFields] = useState<Set<string>>(new Set())
  const [selectedIdx, setSelectedIdx] = useState<number>(-1)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const dropRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.metaKey && e.key === 's') {
        e.preventDefault()
        handleSave()
        return
      }
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
      if (phase === 'results' && !e.metaKey && !e.ctrlKey && !isInput) {
        const num = parseInt(e.key)
        if (num >= 1 && num <= searchResults.length) {
          e.preventDefault()
          handleSelectCandidate(num - 1)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, searchResults, formData])

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 5)
    if (fileArray.length === 0) return

    const types: ImageType[] = ['tag', 'full', 'logo', 'detail', 'other']
    const images: UploadedImage[] = []
    for (let i = 0; i < fileArray.length; i++) {
      const data = await fileToBase64(fileArray[i])
      images.push({ data, name: fileArray[i].name, type: types[i] || 'other', index: i })
    }
    setUploadedImages(images)
    setPhase('searching')

    const results = await searchByImages(fileArray)
    setSearchResults(results)
    setPhase('results')
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files)
  }, [handleFiles])

  const handleSelectCandidate = (idx: number): void => {
    const result = searchResults[idx]
    if (!result) return
    setSelectedIdx(idx)
    const p = result.product
    const fields = new Set<string>()
    const data: ProductFormData = { ...EMPTY_FORM }
    for (const key of Object.keys(EMPTY_FORM) as (keyof ProductFormData)[]) {
      const val = p[key]
      if (val !== undefined && val !== null && val !== '') {
        ;(data as Record<string, unknown>)[key] = val
        fields.add(key)
      }
    }
    setFormData(data)
    setAppliedFields(fields)
  }

  const updateField = (field: keyof ProductFormData, value: string | number): void => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async (): Promise<void> => {
    if (!formData.brand || !formData.category) return
    setSaving(true)
    setPhase('saving')
    try {
      const productId = (await window.api.saveProduct(formData, [])) as number
      if (uploadedImages.length > 0) {
        await window.api.saveImages(
          productId,
          uploadedImages.map(img => ({ data: img.data, type: img.type, index: img.index }))
        )
        for (const img of uploadedImages) {
          try {
            const resp = await fetch(img.data)
            const buf = await resp.arrayBuffer()
            const emb = await generateEmbedding(buf)
            await window.api.saveVector(0, productId, emb)
          } catch { /* skip */ }
        }
      }
      setSaveSuccess(true)
      setPhase('saved')
      setTimeout(() => {
        reset()
        setFormData({ ...EMPTY_FORM })
        setAppliedFields(new Set())
        setSelectedIdx(-1)
        setPhase('idle')
        setSaveSuccess(false)
      }, 1200)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = (): void => {
    reset()
    setFormData({ ...EMPTY_FORM })
    setAppliedFields(new Set())
    setSelectedIdx(-1)
    setPhase('idle')
  }

  const hasForm = formData.brand !== '' || formData.category !== ''
  const canSave = formData.brand !== '' && formData.category !== ''
  const weakResults = searchResults.length > 0 && searchResults[0]?.similarity < 0.5

  return (
    <div className="flex-1 flex overflow-hidden" data-testid="workspace">
      {/* === LEFT PANE: Images === */}
      <div className="pane w-[260px] border-r border-border bg-surface-1 shrink-0">
        <div className="pane-header">
          <span className="text-xs font-semibold text-txt-secondary uppercase tracking-wider">画像</span>
          {uploadedImages.length > 0 && (
            <span data-testid="image-count" className="text-2xs text-txt-tertiary">{uploadedImages.length}/5</span>
          )}
        </div>
        <div className="pane-body p-3">
          {uploadedImages.length === 0 ? (
            <div
              ref={dropRef}
              data-testid="image-drop-zone"
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
              className="relative border-2 border-dashed border-border rounded-xl h-64 flex flex-col items-center justify-center gap-3 hover:border-accent/50 hover:bg-accent-muted transition-all cursor-pointer group"
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                data-testid="file-input"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileInput}
              />
              <div className="w-12 h-12 rounded-xl bg-surface-3 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                <svg className="w-6 h-6 text-txt-tertiary group-hover:text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-txt-secondary">ここに画像をドロップ</p>
                <p className="text-2xs text-txt-muted mt-1">またはクリックして選択</p>
              </div>
              <p className="text-2xs text-txt-muted">最大5枚 / JPG, PNG</p>
            </div>
          ) : (
            <div data-testid="image-previews" className="space-y-2">
              {uploadedImages.map((img, i) => (
                <div key={i} data-testid="image-preview" className="relative group rounded-lg overflow-hidden border border-border bg-surface-2">
                  <img src={img.data} alt={img.name} className="w-full h-28 object-cover" />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <span className="text-2xs text-white/80 font-medium">{IMAGE_TYPE_LABELS[img.type]}</span>
                  </div>
                </div>
              ))}
              <button
                data-testid="clear-images-btn"
                onClick={handleReset}
                className="w-full btn-ghost text-2xs text-txt-muted py-1.5 mt-2"
              >
                画像をクリア
              </button>
            </div>
          )}
        </div>
      </div>

      {/* === CENTER PANE: Candidates === */}
      <div className="pane flex-1 bg-surface-0">
        <div className="pane-header">
          <span className="text-xs font-semibold text-txt-secondary uppercase tracking-wider">
            {phase === 'idle' ? '候補' : phase === 'searching' ? '検索中...' : `候補 (${searchResults.length}件)`}
          </span>
          {phase === 'results' && searchResults.length > 0 && (
            <span className="text-2xs text-txt-muted">数字キー 1-{Math.min(searchResults.length, 5)} で選択</span>
          )}
        </div>
        <div className="pane-body p-4">
          {phase === 'idle' && (
            <div data-testid="phase-idle" className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-txt-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-sm text-txt-secondary font-medium mb-1">画像をドロップして開始</p>
              <p className="text-xs text-txt-muted max-w-[280px]">
                左の画像エリアに商品写真を追加すると、自動で類似候補を検索します
              </p>
            </div>
          )}

          {phase === 'searching' && (
            <div data-testid="phase-searching" className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} data-testid="skeleton-card" className="card p-4 animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
                  <div className="flex gap-3">
                    <div className="skeleton w-20 h-20 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-4 w-32 rounded" />
                      <div className="skeleton h-3 w-48 rounded" />
                      <div className="skeleton h-3 w-24 rounded" />
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 px-1 mt-3">
                <div className="animate-spin w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full" />
                <span className="text-xs text-txt-tertiary">類似商品を照合中... {progress}%</span>
              </div>
            </div>
          )}

          {phase === 'results' && searchResults.length === 0 && (
            <div data-testid="no-results" className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-txt-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <p className="text-sm text-txt-secondary font-medium mb-1">候補が見つかりませんでした</p>
              <p className="text-xs text-txt-muted mb-4">右のフォームから手入力で登録できます</p>
            </div>
          )}

          {phase === 'results' && searchResults.length > 0 && (
            <div data-testid="candidate-list" className="space-y-2">
              {weakResults && (
                <div data-testid="weak-results-banner" className="banner-warning mb-3">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <span>類似度が低めです。手入力のほうが早い場合もあります</span>
                </div>
              )}
              {searchResults.map((result, i) => (
                <CandidateRow
                  key={result.product.id}
                  result={result}
                  index={i}
                  selected={i === selectedIdx}
                  onSelect={() => handleSelectCandidate(i)}
                />
              ))}
            </div>
          )}

          {phase === 'saved' && (
            <div data-testid="phase-saved" className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <p className="text-sm text-txt-primary font-medium">保存しました</p>
              <p className="text-2xs text-txt-muted mt-1">次の商品を登録できます</p>
            </div>
          )}
        </div>
      </div>

      {/* === RIGHT PANE: Draft Form === */}
      <div ref={formRef} className="pane w-[380px] border-l border-border bg-surface-1 shrink-0">
        <div className="pane-header">
          <span className="text-xs font-semibold text-txt-secondary uppercase tracking-wider">下書き</span>
          {appliedFields.size > 0 && (
            <span data-testid="applied-count" className="badge-info">{appliedFields.size}件 候補から適用</span>
          )}
        </div>
        <div className="pane-body p-4 space-y-3">
          <FormField label="ブランド" applied={appliedFields.has('brand')}>
            <input data-testid="form-brand" type="text" className="input-field" value={formData.brand}
              onChange={e => updateField('brand', e.target.value)} list="brand-hints" placeholder="GUCCI" />
            <datalist id="brand-hints">{BRANDS.map(b => <option key={b} value={b} />)}</datalist>
          </FormField>

          <FormField label="カテゴリ" applied={appliedFields.has('category')}>
            <select data-testid="form-category" className="input-field" value={formData.category}
              onChange={e => updateField('category', e.target.value)}>
              <option value="">選択</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormField>

          <FormField label="型番・モデル名" applied={appliedFields.has('model')}>
            <input data-testid="form-model" type="text" className="input-field" value={formData.model}
              onChange={e => updateField('model', e.target.value)} placeholder="GG Marmont ショルダー" />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="サイズ" applied={appliedFields.has('size')}>
              <input data-testid="form-size" type="text" className="input-field" value={formData.size}
                onChange={e => updateField('size', e.target.value)} placeholder="M" />
            </FormField>
            <FormField label="色" applied={appliedFields.has('color')}>
              <input data-testid="form-color" type="text" className="input-field" value={formData.color}
                onChange={e => updateField('color', e.target.value)} placeholder="ブラック" />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="素材" applied={appliedFields.has('material')}>
              <input data-testid="form-material" type="text" className="input-field" value={formData.material}
                onChange={e => updateField('material', e.target.value)} placeholder="レザー" />
            </FormField>
            <FormField label="状態" applied={appliedFields.has('condition')}>
              <select data-testid="form-condition" className="input-field" value={formData.condition}
                onChange={e => updateField('condition', e.target.value)}>
                {CONDITIONS.map(c => <option key={c} value={c}>{c}ランク</option>)}
              </select>
            </FormField>
          </div>

          <FormField label="買取価格" applied={appliedFields.has('price')}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted text-sm">¥</span>
              <input data-testid="form-price" type="number" className="input-field pl-7" value={formData.price || ''}
                onChange={e => updateField('price', parseInt(e.target.value) || 0)} placeholder="50,000" min={0} />
            </div>
          </FormField>

          <FormField label="備考" applied={appliedFields.has('notes')}>
            <textarea data-testid="form-notes" className="input-field min-h-[60px] resize-y" value={formData.notes}
              onChange={e => updateField('notes', e.target.value)} placeholder="状態詳細、付属品など" rows={2} />
          </FormField>
        </div>

        <div className="border-t border-border p-3 flex items-center gap-2 shrink-0 bg-surface-1">
          <button data-testid="save-btn" onClick={handleSave} disabled={!canSave || saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving ? (
              <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
            {saving ? '保存中...' : '保存'}
            {!saving && <span className="kbd text-white/50 border-white/20 ml-1">⌘S</span>}
          </button>
          {hasForm && (
            <button data-testid="reset-btn" onClick={handleReset} className="btn-ghost text-txt-muted text-xs px-3">
              リセット
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function FormField({ label, applied, children }: {
  label: string; applied?: boolean; children: React.ReactNode
}): JSX.Element {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="label mb-0">{label}</label>
        {applied && <ConfidenceBadge confidence={0.8} isApplied />}
      </div>
      {children}
    </div>
  )
}

function CandidateRow({ result, index, selected, onSelect }: {
  result: SearchResult; index: number; selected: boolean; onSelect: () => void
}): JSX.Element {
  const { product, similarity, matchReasons } = result
  const [thumb, setThumb] = useState<string | null>(null)

  useEffect(() => {
    if (result.images.length > 0) {
      window.api.readImage(result.images[0].image_path).then(d => { if (d) setThumb(d) })
    }
  }, [result.images])

  const pct = Math.round(similarity * 100)

  return (
    <div
      data-testid="candidate-row"
      data-selected={selected}
      onClick={onSelect}
      className={`group rounded-lg p-3 cursor-pointer transition-all duration-100 border animate-slide-up ${
        selected
          ? 'bg-accent-muted border-accent/40'
          : 'bg-surface-2 border-border hover:border-border-accent hover:bg-surface-3'
      }`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex gap-3">
        <div className="w-16 h-16 rounded-lg bg-surface-3 shrink-0 overflow-hidden">
          {thumb ? <img src={thumb} className="w-full h-full object-cover" /> : (
            <div className="w-full h-full flex items-center justify-center text-txt-muted text-2xs">---</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-5 h-5 rounded flex items-center justify-center text-2xs font-bold shrink-0 ${
              selected ? 'bg-accent text-white' : 'bg-surface-4 text-txt-tertiary'
            }`}>
              {index + 1}
            </span>
            <span data-testid="candidate-brand" className="text-sm font-semibold text-txt-primary truncate">{product.brand}</span>
            <span data-testid="candidate-category" className="badge-info shrink-0">{product.category}</span>
          </div>
          <p className="text-xs text-txt-secondary truncate mb-1.5">{product.model}</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${pct >= 70 ? 'bg-emerald-400' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} />
              <span data-testid="candidate-score" className="text-2xs text-txt-tertiary tabular-nums">{pct}%</span>
            </div>
            {matchReasons.slice(0, 2).map((r, i) => (
              <span key={i} className="text-2xs text-txt-muted">{r}</span>
            ))}
            <span className="text-xs font-medium text-txt-secondary ml-auto tabular-nums">
              ¥{product.price.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
