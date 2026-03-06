import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchFlow } from '../contexts/SearchFlowContext'
import { useSearch } from '../hooks/useSearch'
import { fileToBase64, generateVectors } from '../lib/embedding'
import type { OcrFields } from '../lib/textSimilarity'
import type {
  UploadedImage,
  ProductFormData,
  ProductImage,
  SearchResult,
  SearchFilter
} from '@shared/types'
import { BRANDS, CATEGORIES, CONDITIONS, COLORS, MATERIALS } from '@shared/types'
import ConfidenceBadge from '../components/ConfidenceBadge'
import TagRegionSelector from '../components/TagRegionSelector'
import type { OcrExtractResult } from '../components/TagRegionSelector'

const EMPTY_FORM: ProductFormData = {
  brand: '',
  category: '',
  model: '',
  size: '',
  color: '',
  material: '',
  condition: 'B',
  price: 0,
  notes: ''
}

const EMPTY_FILTER: SearchFilter = {}

type WorkspacePhase = 'idle' | 'searching' | 'results' | 'saving' | 'saved'
type ViewMode = 'list' | 'grid'

export default function Workspace(): JSX.Element {
  const { uploadedImages, setUploadedImages, searchResults, setSearchResults, reset } =
    useSearchFlow()
  const {
    loading,
    progress,
    conflict,
    searchByImages,
    reSearchWithFilters,
    searchByFilters,
    applyTagDrivenScoring,
    clearCache
  } = useSearch()

  const [phase, setPhase] = useState<WorkspacePhase>('idle')
  const [formData, setFormData] = useState<ProductFormData>({ ...EMPTY_FORM })
  const [appliedFields, setAppliedFields] = useState<Set<string>>(new Set())
  const [selectedIdx, setSelectedIdx] = useState<number>(-1)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [filters, setFilters] = useState<SearchFilter>({ ...EMPTY_FILTER })
  const [showFilters, setShowFilters] = useState(false)

  const [zoomedImageIdx, setZoomedImageIdx] = useState<number | null>(null)

  useEffect(() => {
    if (zoomedImageIdx === null) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setZoomedImageIdx(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [zoomedImageIdx])

  const hasImagesRef = useRef(false)
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
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
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

  const applyResults = useCallback(
    (results: SearchResult[], hasImages: boolean, hasFilters: boolean) => {
      setSearchResults(results)
      setPhase(results.length > 0 || hasImages || hasFilters ? 'results' : 'idle')
    },
    [setSearchResults]
  )

  const [ocrStatus, setOcrStatus] = useState<string | null>(null)

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files)
        .filter((f) => f.type.startsWith('image/'))
        .slice(0, 5)
      if (fileArray.length === 0) return

      const images: UploadedImage[] = []
      for (let i = 0; i < fileArray.length; i++) {
        const data = await fileToBase64(fileArray[i])
        images.push({ data, name: fileArray[i].name, type: 'other', index: i })
      }
      setUploadedImages(images)
      hasImagesRef.current = true
      setPhase('searching')
      setOcrStatus('AI画像分類中...')

      // Step 0: classify all images in parallel + start visual search
      const hasActiveFilter = Object.values(filters).some((v) => v)

      const classifyPromise = Promise.all(
        images.map((img) =>
          window.api.classifyImageType(img.data).catch(() => ({
            image_type: 'other' as const,
            confidence: 0
          }))
        )
      )

      const searchPromise = searchByImages(
        fileArray,
        10,
        hasActiveFilter ? filters : undefined
      )

      const [classifyResults, initialResults] = await Promise.all([
        classifyPromise,
        searchPromise
      ])

      // Apply classification to uploaded images (threshold lowered for better recall)
      const updatedImages = images.map((img, i) => {
        const classified = classifyResults[i]
        if (classified && classified.confidence >= 0.4) {
          return { ...img, type: classified.image_type as UploadedImage['type'] }
        }
        return img
      })
      setUploadedImages(updatedImages)

      // Find tag image for OCR
      const tagImage = updatedImages.find((img) => img.type === 'tag')
      const hasTag = tagImage !== undefined

      console.log('[handleFiles] classification results:', classifyResults)
      console.log('[handleFiles] hasTag:', hasTag, 'tagImage index:', tagImage?.index)

      if (hasTag && tagImage) {
        setOcrStatus('タグ画像を解析中...')
        const ocrResult = await window.api.extractFromImage(tagImage.data).catch(() => null)

        console.log('[handleFiles] tag OCR result:', ocrResult)

        if (ocrResult && (ocrResult.brand || ocrResult.category || ocrResult.model) && ocrResult.confidence > 0.3) {
          const detectedParts = [
            ocrResult.model ? `型番: ${ocrResult.model}` : null,
            ocrResult.brand,
            ocrResult.category
          ].filter(Boolean)
          setOcrStatus(`タグ検出: ${detectedParts.join(' / ')}`)

          const ocrFields: OcrFields = {
            brand: ocrResult.brand ?? null,
            category: ocrResult.category ?? null,
            model: ocrResult.model ?? null,
            size: ocrResult.size ?? null,
            material: ocrResult.material ?? null
          }

          const { results: scoredResults } = await applyTagDrivenScoring(
            initialResults,
            ocrFields,
            true
          )
          console.log('[handleFiles] tag-driven scored results:', scoredResults.slice(0, 3).map(r => ({ id: r.product.id, brand: r.product.brand, sim: r.similarity, source: r.matchSource })))
          applyResults(scoredResults, true, hasActiveFilter)
        } else {
          setOcrStatus(null)
          applyResults(initialResults, true, hasActiveFilter)
        }
      } else {
        // No tag detected: OCR ALL images in parallel, pick best result
        setOcrStatus('全画像をAI解析中...')
        console.log('[handleFiles] no tag detected, running OCR on all images')

        const ocrPromises = images.map((img) =>
          window.api.extractFromImage(img.data).catch(() => null)
        )
        const allOcrResults = await Promise.all(ocrPromises)

        console.log('[handleFiles] all OCR results:', allOcrResults)

        let bestOcr: typeof allOcrResults[number] = null
        let bestOcrConfidence = 0
        let bestOcrHasTag = false
        for (let i = 0; i < allOcrResults.length; i++) {
          const r = allOcrResults[i]
          if (r && (r.brand || r.category || r.model) && r.confidence > bestOcrConfidence) {
            bestOcr = r
            bestOcrConfidence = r.confidence
            bestOcrHasTag = updatedImages[i]?.type === 'tag'
          }
        }

        if (bestOcr && bestOcrConfidence > 0.3) {
          const detectedParts = [
            bestOcr.model ? `型番: ${bestOcr.model}` : null,
            bestOcr.brand,
            bestOcr.category
          ].filter(Boolean)
          setOcrStatus(`AI検出: ${detectedParts.join(' / ')}`)

          const ocrFields: OcrFields = {
            brand: bestOcr.brand ?? null,
            category: bestOcr.category ?? null,
            model: bestOcr.model ?? null,
            size: bestOcr.size ?? null,
            material: bestOcr.material ?? null
          }

          // Even without explicit tag classification, if OCR found strong brand/model info, treat it as tag-level
          const treatAsTag = bestOcrHasTag || bestOcrConfidence >= 0.7
          console.log('[handleFiles] bestOcr:', bestOcr, 'treatAsTag:', treatAsTag)

          const { results: scoredResults } = await applyTagDrivenScoring(
            initialResults,
            ocrFields,
            treatAsTag
          )
          console.log('[handleFiles] fallback scored results:', scoredResults.slice(0, 3).map(r => ({ id: r.product.id, brand: r.product.brand, sim: r.similarity, source: r.matchSource })))
          applyResults(scoredResults, true, hasActiveFilter)
        } else {
          setOcrStatus(null)
          applyResults(initialResults, true, hasActiveFilter)
        }
      }
    },
    [filters, searchByImages, applyTagDrivenScoring, setUploadedImages, applyResults]
  )

  const handleManualOcrResult = useCallback(
    async (result: OcrExtractResult) => {
      if (!result || (!result.brand && !result.category && !result.model)) return

      const detectedParts = [
        result.model ? `型番: ${result.model}` : null,
        result.brand,
        result.category
      ].filter(Boolean)
      setOcrStatus(`手動タグ検出: ${detectedParts.join(' / ')}`)

      const ocrFields: OcrFields = {
        brand: result.brand ?? null,
        category: result.category ?? null,
        model: result.model ?? null,
        size: result.size ?? null,
        material: result.material ?? null
      }

      console.log('[handleManualOcrResult] applying manual OCR:', ocrFields)

      const currentResults = searchResults
      if (currentResults.length > 0) {
        const { results: scoredResults } = await applyTagDrivenScoring(
          currentResults,
          ocrFields,
          true
        )
        console.log('[handleManualOcrResult] re-scored results:', scoredResults.slice(0, 3).map(r => ({ id: r.product.id, brand: r.product.brand, sim: r.similarity, source: r.matchSource })))
        applyResults(scoredResults, true, false)
      }
    },
    [searchResults, applyTagDrivenScoring, applyResults]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) handleFiles(e.target.files)
    },
    [handleFiles]
  )

  const handleFilterChange = useCallback(
    (key: keyof SearchFilter, value: string) => {
      const next = { ...filters, [key]: value || undefined }
      setFilters(next)

      const hasActiveFilter = Object.values(next).some((v) => v)

      if (hasImagesRef.current) {
        setPhase('searching')
        reSearchWithFilters(hasActiveFilter ? next : undefined, 10).then((results) => {
          applyResults(results, true, hasActiveFilter)
        })
      } else if (hasActiveFilter) {
        setPhase('searching')
        searchByFilters(next, 10).then((results) => {
          applyResults(results, false, true)
        })
      }
    },
    [filters, reSearchWithFilters, searchByFilters, applyResults]
  )

  const handleClearFilters = useCallback(() => {
    setFilters({ ...EMPTY_FILTER })
    if (hasImagesRef.current) {
      setPhase('searching')
      reSearchWithFilters(undefined, 10).then((results) => {
        applyResults(results, true, false)
      })
    } else {
      setSearchResults([])
      setPhase('idle')
    }
  }, [reSearchWithFilters, applyResults, setSearchResults])

  const handleFilterSearch = useCallback(() => {
    const hasActiveFilter = Object.values(filters).some((v) => v)
    if (!hasActiveFilter) return

    if (hasImagesRef.current) {
      setPhase('searching')
      reSearchWithFilters(filters, 10).then((results) => {
        applyResults(results, true, true)
      })
    } else {
      setPhase('searching')
      searchByFilters(filters, 10).then((results) => {
        applyResults(results, false, true)
      })
    }
  }, [filters, reSearchWithFilters, searchByFilters, applyResults])

  const activeFilterCount = Object.values(filters).filter((v) => v).length

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
        ;(data as unknown as Record<string, unknown>)[key] = val
        fields.add(key)
      }
    }
    setFormData(data)
    setAppliedFields(fields)
  }

  const updateField = (field: keyof ProductFormData, value: string | number): void => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async (): Promise<void> => {
    if (!formData.brand || !formData.category) return
    setSaving(true)
    setPhase('saving')
    try {
      const productId = (await window.api.saveProduct(formData, [])) as number
      if (uploadedImages.length > 0) {
        const savedImages = (await window.api.saveImages(
          productId,
          uploadedImages.map((img) => ({ data: img.data, type: img.type, index: img.index }))
        )) as Array<{ path: string; type: string; index: number; imageId: number }>

        for (let i = 0; i < uploadedImages.length; i++) {
          try {
            const imageId = savedImages[i]?.imageId ?? 0
            if (!imageId) continue
            const { clipVector, v2Vector } = await generateVectors(uploadedImages[i].data)
            await window.api.saveVector(imageId, productId, v2Vector)
            if (clipVector) {
              await window.api.saveVector(imageId, productId, clipVector)
            }
          } catch (e) {
            console.error('Failed to save vector for image', i, e)
          }
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
        hasImagesRef.current = false
        clearCache()
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
    hasImagesRef.current = false
    clearCache()
    setFilters({ ...EMPTY_FILTER })
  }

  const hasForm = formData.brand !== '' || formData.category !== ''
  const canSave = formData.brand !== '' && formData.category !== ''
  const weakResults = searchResults.length > 0 && searchResults[0]?.similarity < 0.5

  return (
    <div className="flex-1 flex overflow-hidden" data-testid="workspace">
      {/* === LEFT PANE: Images === */}
      <div className="pane w-[260px] border-r border-border bg-surface-1 shrink-0">
        <div className="pane-header">
          <span className="text-xs font-semibold text-txt-secondary uppercase tracking-wider">
            画像
          </span>
          {uploadedImages.length > 0 && (
            <span data-testid="image-count" className="text-2xs text-txt-tertiary">
              {uploadedImages.length}/5
            </span>
          )}
        </div>
        <div className="pane-body p-3">
          {uploadedImages.length === 0 ? (
            <div
              ref={dropRef}
              data-testid="image-drop-zone"
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
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
                <svg
                  className="w-6 h-6 text-txt-tertiary group-hover:text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                  />
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
                <div
                  key={i}
                  data-testid="image-preview"
                  className="relative group rounded-lg overflow-hidden border border-border bg-surface-2 cursor-pointer"
                  onClick={() => setZoomedImageIdx(zoomedImageIdx === i ? null : i)}
                >
                  <img src={img.data} alt={img.name} className="w-full h-28 object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                    </svg>
                  </div>
                </div>
              ))}
              {zoomedImageIdx !== null && uploadedImages[zoomedImageIdx] && (
                <TagRegionSelector
                  imageSrc={uploadedImages[zoomedImageIdx].data}
                  onClose={() => setZoomedImageIdx(null)}
                  onOcrResult={(result: OcrExtractResult) => {
                    setZoomedImageIdx(null)
                    handleManualOcrResult(result)
                  }}
                />
              )}
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
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-txt-secondary uppercase tracking-wider shrink-0">
              {phase === 'idle'
                ? '候補'
                : phase === 'searching'
                  ? '検索中...'
                  : `候補 (${searchResults.length}件)`}
            </span>
            {activeFilterCount > 0 && (
              <span className="text-2xs bg-accent/15 text-accent px-1.5 py-0.5 rounded-full font-medium shrink-0">
                {activeFilterCount}件の絞り込み
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {phase === 'results' && searchResults.length > 0 && (
              <span className="text-2xs text-txt-muted mr-2">
                数字キー 1-{Math.min(searchResults.length, 9)} で選択
              </span>
            )}
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`p-1.5 rounded-md transition-colors ${
                showFilters
                  ? 'bg-accent/15 text-accent'
                  : 'text-txt-tertiary hover:text-txt-secondary hover:bg-surface-2'
              }`}
              title="絞り込み"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"
                />
              </svg>
            </button>
            <div className="w-px h-4 bg-border mx-0.5" />
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-accent/15 text-accent'
                  : 'text-txt-tertiary hover:text-txt-secondary hover:bg-surface-2'
              }`}
              title="リスト表示"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-accent/15 text-accent'
                  : 'text-txt-tertiary hover:text-txt-secondary hover:bg-surface-2'
              }`}
              title="グリッド表示"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div className="border-b border-border bg-surface-1/50 px-4 py-3 animate-fade-in">
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-2xs text-txt-muted mb-0.5 block">ブランド</label>
                <select
                  className="input-field text-xs py-1.5"
                  value={filters.brand || ''}
                  onChange={(e) => handleFilterChange('brand', e.target.value)}
                >
                  <option value="">すべて</option>
                  {BRANDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-2xs text-txt-muted mb-0.5 block">カテゴリ</label>
                <select
                  className="input-field text-xs py-1.5"
                  value={filters.category || ''}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                >
                  <option value="">すべて</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-2xs text-txt-muted mb-0.5 block">色</label>
                <select
                  className="input-field text-xs py-1.5"
                  value={filters.color || ''}
                  onChange={(e) => handleFilterChange('color', e.target.value)}
                >
                  <option value="">すべて</option>
                  {COLORS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-2xs text-txt-muted mb-0.5 block">素材</label>
                <select
                  className="input-field text-xs py-1.5"
                  value={filters.material || ''}
                  onChange={(e) => handleFilterChange('material', e.target.value)}
                >
                  <option value="">すべて</option>
                  {MATERIALS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              {activeFilterCount > 0 && (
                <button
                  onClick={handleClearFilters}
                  className="text-2xs text-txt-muted hover:text-txt-secondary transition-colors"
                >
                  絞り込みをクリア
                </button>
              )}
              {uploadedImages.length === 0 && activeFilterCount > 0 && (
                <button
                  onClick={handleFilterSearch}
                  className="ml-auto btn-primary text-2xs px-3 py-1"
                >
                  属性で検索
                </button>
              )}
            </div>
          </div>
        )}

        <div className="pane-body p-4">
          {phase === 'idle' && (
            <div
              data-testid="phase-idle"
              className="flex flex-col items-center justify-center h-full text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-txt-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <p className="text-sm text-txt-secondary font-medium mb-1">
                画像をドロップして開始
              </p>
              <p className="text-xs text-txt-muted max-w-[280px]">
                左の画像エリアに商品写真を追加すると、自動で類似候補を検索します。
                <button
                  onClick={() => setShowFilters(true)}
                  className="text-accent hover:underline ml-1"
                >
                  属性で絞り込み
                </button>
                もできます
              </p>
            </div>
          )}

          {phase === 'searching' && (
            <div data-testid="phase-searching" className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  data-testid="skeleton-card"
                  className="card p-4 animate-fade-in"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
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
                <span className="text-xs text-txt-tertiary">
                  {ocrStatus ?? `類似商品を照合中... ${progress}%`}
                </span>
              </div>
            </div>
          )}

          {phase === 'results' && searchResults.length === 0 && (
            <div
              data-testid="no-results"
              className="flex flex-col items-center justify-center h-full text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center mb-3">
                <svg
                  className="w-7 h-7 text-txt-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                </svg>
              </div>
              <p className="text-sm text-txt-secondary font-medium mb-1">
                候補が見つかりませんでした
              </p>
              <p className="text-xs text-txt-muted mb-4">
                右のフォームから手入力で登録できます
              </p>
            </div>
          )}

          {phase === 'results' && searchResults.length > 0 && (
            <div data-testid="candidate-list">
              {ocrStatus && (
                <div className="flex items-center gap-2 px-2 py-1.5 mb-3 rounded-lg bg-accent-muted/30 border border-accent/20">
                  <svg className="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                  <span className="text-xs text-accent">{ocrStatus}</span>
                </div>
              )}
              {conflict?.hasConflict && conflict.message && (
                <div data-testid="conflict-banner" className="flex items-start gap-2 px-3 py-2 mb-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <span className="text-xs text-amber-300 leading-relaxed">{conflict.message}</span>
                </div>
              )}
              {weakResults && (
                <div data-testid="weak-results-banner" className="banner-warning mb-3">
                  <svg
                    className="w-4 h-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                    />
                  </svg>
                  <span>類似度が低めです。手入力のほうが早い場合もあります</span>
                </div>
              )}
              {viewMode === 'list' ? (
                <div className="space-y-2">
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
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {searchResults.map((result, i) => (
                    <CandidateCard
                      key={result.product.id}
                      result={result}
                      index={i}
                      selected={i === selectedIdx}
                      onSelect={() => handleSelectCandidate(i)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {phase === 'saved' && (
            <div
              data-testid="phase-saved"
              className="flex flex-col items-center justify-center h-full text-center animate-fade-in"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mb-3">
                <svg
                  className="w-7 h-7 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
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
          <span className="text-xs font-semibold text-txt-secondary uppercase tracking-wider">
            下書き
          </span>
          {appliedFields.size > 0 && (
            <span data-testid="applied-count" className="badge-info">
              {appliedFields.size}件 候補から適用
            </span>
          )}
        </div>
        <div className="pane-body p-4 space-y-3">
          <FormField label="ブランド" applied={appliedFields.has('brand')}>
            <input
              data-testid="form-brand"
              type="text"
              className="input-field"
              value={formData.brand}
              onChange={(e) => updateField('brand', e.target.value)}
              list="brand-hints"
              placeholder="GUCCI"
            />
            <datalist id="brand-hints">
              {BRANDS.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </FormField>

          <FormField label="カテゴリ" applied={appliedFields.has('category')}>
            <select
              data-testid="form-category"
              className="input-field"
              value={formData.category}
              onChange={(e) => updateField('category', e.target.value)}
            >
              <option value="">選択</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="型番・モデル名" applied={appliedFields.has('model')}>
            <input
              data-testid="form-model"
              type="text"
              className="input-field"
              value={formData.model}
              onChange={(e) => updateField('model', e.target.value)}
              placeholder="GG Marmont ショルダー"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="サイズ" applied={appliedFields.has('size')}>
              <input
                data-testid="form-size"
                type="text"
                className="input-field"
                value={formData.size}
                onChange={(e) => updateField('size', e.target.value)}
                placeholder="M"
              />
            </FormField>
            <FormField label="色" applied={appliedFields.has('color')}>
              <input
                data-testid="form-color"
                type="text"
                className="input-field"
                value={formData.color}
                onChange={(e) => updateField('color', e.target.value)}
                placeholder="ブラック"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="素材" applied={appliedFields.has('material')}>
              <input
                data-testid="form-material"
                type="text"
                className="input-field"
                value={formData.material}
                onChange={(e) => updateField('material', e.target.value)}
                placeholder="レザー"
              />
            </FormField>
            <FormField label="状態" applied={appliedFields.has('condition')}>
              <select
                data-testid="form-condition"
                className="input-field"
                value={formData.condition}
                onChange={(e) => updateField('condition', e.target.value)}
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}ランク
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="買取価格" applied={appliedFields.has('price')}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted text-sm">
                ¥
              </span>
              <input
                data-testid="form-price"
                type="number"
                className="input-field pl-7"
                value={formData.price || ''}
                onChange={(e) => updateField('price', parseInt(e.target.value) || 0)}
                placeholder="50,000"
                min={0}
              />
            </div>
          </FormField>

          <FormField label="備考" applied={appliedFields.has('notes')}>
            <textarea
              data-testid="form-notes"
              className="input-field min-h-[60px] resize-y"
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="状態詳細、付属品など"
              rows={2}
            />
          </FormField>
        </div>

        <div className="border-t border-border p-3 flex items-center gap-2 shrink-0 bg-surface-1">
          <button
            data-testid="save-btn"
            onClick={handleSave}
            disabled={!canSave || saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {saving ? (
              <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            )}
            {saving ? '保存中...' : '保存'}
            {!saving && <span className="kbd bg-white/20 text-white border-white/30 ml-1">⌘S</span>}
          </button>
          {hasForm && (
            <button
              data-testid="reset-btn"
              onClick={handleReset}
              className="btn-ghost text-txt-muted text-xs px-3"
            >
              リセット
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function FormField({
  label,
  applied,
  children
}: {
  label: string
  applied?: boolean
  children: React.ReactNode
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

function CandidateRow({
  result,
  index,
  selected,
  onSelect
}: {
  result: SearchResult
  index: number
  selected: boolean
  onSelect: () => void
}): JSX.Element {
  const { product, similarity, matchReasons, confidence } = result
  const [thumb, setThumb] = useState<string | null>(null)

  useEffect(() => {
    if (result.images.length > 0) {
      window.api.readImage(result.images[0].image_path).then((d) => {
        if (d) setThumb(d)
      })
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
          {thumb ? (
            <img src={thumb} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-txt-muted text-2xs">
              ---
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`w-5 h-5 rounded flex items-center justify-center text-2xs font-bold shrink-0 ${
                selected ? 'bg-accent text-white' : 'bg-surface-4 text-txt-tertiary'
              }`}
            >
              {index + 1}
            </span>
            <span
              data-testid="candidate-brand"
              className="text-sm font-semibold text-txt-primary truncate"
            >
              {product.brand}
            </span>
            <span data-testid="candidate-category" className="badge-info shrink-0">
              {product.category}
            </span>
            <ConfidenceBadge confidence={similarity} level={confidence} />
          </div>
          <p className="text-xs text-txt-secondary truncate mb-1.5">{product.model}</p>
          <div className="flex items-center gap-3">
            <span
              data-testid="candidate-score"
              className="text-2xs text-txt-tertiary tabular-nums"
            >
              {pct > 0 ? `類似度 ${pct}%` : '属性一致'}
            </span>
            {matchReasons.slice(0, 2).map((r, i) => (
              <span key={i} className="text-2xs text-txt-muted">
                {r}
              </span>
            ))}
            <span className="text-xs font-medium text-txt-secondary ml-auto tabular-nums">
              ¥{product.price.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
      {selected && result.images.length > 1 && <ImageStrip images={result.images} />}
    </div>
  )
}

function CandidateCard({
  result,
  index,
  selected,
  onSelect
}: {
  result: SearchResult
  index: number
  selected: boolean
  onSelect: () => void
}): JSX.Element {
  const { product, similarity, confidence } = result
  const [thumb, setThumb] = useState<string | null>(null)

  useEffect(() => {
    if (result.images.length > 0) {
      window.api.readImage(result.images[0].image_path).then((d) => {
        if (d) setThumb(d)
      })
    }
  }, [result.images])

  const pct = Math.round(similarity * 100)

  return (
    <div
      data-testid="candidate-card"
      data-selected={selected}
      onClick={onSelect}
      className={`group rounded-xl cursor-pointer transition-all duration-100 border overflow-hidden animate-slide-up ${
        selected
          ? 'bg-accent-muted border-accent/40 ring-1 ring-accent/30'
          : 'bg-surface-2 border-border hover:border-border-accent hover:bg-surface-3'
      }`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="relative aspect-square bg-surface-3 overflow-hidden">
        {thumb ? (
          <img src={thumb} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-txt-muted text-xs">
            No Image
          </div>
        )}
        <span
          className={`absolute top-2 left-2 w-6 h-6 rounded-md flex items-center justify-center text-2xs font-bold ${
            selected ? 'bg-accent text-white' : 'bg-black/50 text-white/80'
          }`}
        >
          {index + 1}
        </span>
        <span className="absolute top-2 right-2">
          <ConfidenceBadge confidence={similarity} level={confidence} />
        </span>
      </div>
      <div className="p-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs font-semibold text-txt-primary truncate">{product.brand}</span>
          <span className="badge-info text-2xs shrink-0">{product.category}</span>
        </div>
        <p className="text-2xs text-txt-secondary truncate mb-1.5">{product.model}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-txt-secondary tabular-nums">
            ¥{product.price.toLocaleString()}
          </span>
          {product.color && (
            <span className="text-2xs text-txt-muted truncate ml-1">{product.color}</span>
          )}
        </div>
        {selected && result.images.length > 1 && (
          <ImageStripMini images={result.images} />
        )}
      </div>
    </div>
  )
}

function ImageStripMini({ images }: { images: ProductImage[] }): JSX.Element | null {
  const [thumbs, setThumbs] = useState<Map<number, string>>(new Map())
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    images.forEach((img) => {
      window.api.readImage(img.image_path).then((d) => {
        if (d && !cancelled) {
          setThumbs((prev) => new Map(prev).set(img.id, d))
        }
      })
    })
    return () => {
      cancelled = true
    }
  }, [images])

  if (images.length <= 1) return null

  const expandedSrc = expandedId !== null ? thumbs.get(expandedId) : null

  return (
    <div className="pt-2 mt-2 border-t border-border/50">
      {expandedSrc && (
        <div className="mb-2">
          <img
            src={expandedSrc}
            className="max-h-36 rounded-md object-contain cursor-pointer"
            onClick={() => setExpandedId(null)}
          />
        </div>
      )}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {images.map((img) => {
          const src = thumbs.get(img.id)
          const isActive = expandedId === img.id
          return (
            <div
              key={img.id}
              className={`w-12 h-12 rounded-md bg-surface-3 shrink-0 overflow-hidden cursor-pointer ring-2 transition-all ${
                isActive ? 'ring-accent' : 'ring-transparent hover:ring-border-accent'
              }`}
              onClick={() => setExpandedId(isActive ? null : img.id)}
            >
              {src ? (
                <img src={src} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-txt-muted text-2xs animate-pulse">
                  ...
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ImageStrip({ images }: { images: ProductImage[] }): JSX.Element | null {
  const [thumbs, setThumbs] = useState<Map<number, string>>(new Map())
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    images.forEach((img) => {
      window.api.readImage(img.image_path).then((d) => {
        if (d && !cancelled) {
          setThumbs((prev) => new Map(prev).set(img.id, d))
        }
      })
    })
    return () => {
      cancelled = true
    }
  }, [images])

  if (images.length <= 1) return null

  const expandedSrc = expandedId !== null ? thumbs.get(expandedId) : null

  return (
    <div className="pt-2 mt-2 border-t border-border/50">
      {expandedSrc && (
        <div className="mb-2">
          <img
            src={expandedSrc}
            className="max-h-48 rounded-lg object-contain cursor-pointer"
            onClick={() => setExpandedId(null)}
          />
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {images.map((img) => {
          const src = thumbs.get(img.id)
          const isActive = expandedId === img.id
          return (
            <div
              key={img.id}
              className={`w-20 h-20 rounded-lg bg-surface-3 shrink-0 overflow-hidden cursor-pointer ring-2 transition-all ${
                isActive ? 'ring-accent' : 'ring-transparent hover:ring-border-accent'
              }`}
              onClick={() => setExpandedId(isActive ? null : img.id)}
            >
              {src ? (
                <img src={src} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-txt-muted text-2xs animate-pulse">
                  ...
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
