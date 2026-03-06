import { useState, useCallback, useRef } from 'react'
import type { SearchResult, SearchFilter } from '@shared/types'
import { generateVectors, fileToBase64 } from '../lib/embedding'
import type { VectorsResult } from '../lib/embedding'
import { boostResultsWithText, mergeModelResults, detectConflict } from '../lib/textSimilarity'
import type { OcrFields, ConflictInfo } from '../lib/textSimilarity'

interface CachedQuery {
  vectorPairs: VectorsResult[]
  base64s: string[]
}

export function useSearch() {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<SearchResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<ConflictInfo | null>(null)

  const cached = useRef<CachedQuery>({ vectorPairs: [], base64s: [] })
  const cachedOcr = useRef<OcrFields | null>(null)

  const searchWithVectorPairs = useCallback(
    async (
      vectorPairs: VectorsResult[],
      limit: number,
      filters?: SearchFilter
    ): Promise<SearchResult[]> => {
      const v2Vectors = vectorPairs.map((vp) => vp.v2Vector)
      const clipVectors = vectorPairs.map((vp) => vp.clipVector)

      const searchResults: SearchResult[] = await window.api.searchHybridBatch(
        v2Vectors,
        clipVectors,
        limit * 2,
        filters
      )

      return searchResults.slice(0, limit)
    },
    []
  )

  const searchByImages = useCallback(
    async (files: File[], limit = 10, filters?: SearchFilter): Promise<SearchResult[]> => {
      setLoading(true)
      setProgress(0)
      setError(null)
      setResults([])
      setConflict(null)

      try {
        const validFiles = files.filter((f) => f.size > 0)
        if (validFiles.length === 0) {
          throw new Error('検索する画像を1枚以上選択してください')
        }

        const vectorPairs: VectorsResult[] = []
        const base64s: string[] = []

        for (let i = 0; i < validFiles.length; i++) {
          setProgress(Math.round(((i + 0.2) / validFiles.length) * 100))

          const base64 = await fileToBase64(validFiles[i])
          base64s.push(base64)

          setProgress(Math.round(((i + 0.5) / validFiles.length) * 100))

          const vecs = await generateVectors(base64)
          vectorPairs.push(vecs)

          setProgress(Math.round(((i + 0.9) / validFiles.length) * 100))
        }

        cached.current = { vectorPairs, base64s }

        const sorted = await searchWithVectorPairs(vectorPairs, limit, filters)
        setProgress(100)
        setResults(sorted)
        return sorted
      } catch (err) {
        const msg = err instanceof Error ? err.message : '検索中にエラーが発生しました'
        setError(msg)
        return []
      } finally {
        setLoading(false)
      }
    },
    [searchWithVectorPairs]
  )

  const reSearchWithFilters = useCallback(
    async (filters?: SearchFilter, limit = 10): Promise<SearchResult[]> => {
      if (cached.current.vectorPairs.length === 0) return []

      setLoading(true)
      setError(null)

      try {
        const sorted = await searchWithVectorPairs(cached.current.vectorPairs, limit, filters)
        setResults(sorted)
        return sorted
      } catch (err) {
        const msg = err instanceof Error ? err.message : '検索中にエラーが発生しました'
        setError(msg)
        return []
      } finally {
        setLoading(false)
      }
    },
    [searchWithVectorPairs]
  )

  const searchByFilters = useCallback(
    async (filters: SearchFilter, limit = 10): Promise<SearchResult[]> => {
      setLoading(true)
      setError(null)
      setResults([])

      try {
        const searchResults: SearchResult[] = await window.api.searchSimilar(null, limit, filters)
        setResults(searchResults)
        return searchResults
      } catch (err) {
        const msg = err instanceof Error ? err.message : '検索中にエラーが発生しました'
        setError(msg)
        return []
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const searchByProductImages = useCallback(
    async (imagePaths: string[], limit = 5): Promise<SearchResult[]> => {
      setLoading(true)
      setError(null)

      try {
        const firstPath = imagePaths[0]
        if (!firstPath) throw new Error('画像がありません')

        const base64 = await window.api.readImage(firstPath)
        if (!base64) throw new Error('画像の読み込みに失敗しました')

        const vecs = await generateVectors(base64)

        const searchResults: SearchResult[] = await window.api.searchHybrid(
          vecs.v2Vector,
          vecs.clipVector,
          limit
        )
        setResults(searchResults)
        return searchResults
      } catch (err) {
        const msg = err instanceof Error ? err.message : '検索中にエラーが発生しました'
        setError(msg)
        return []
      } finally {
        setLoading(false)
      }
    },
    []
  )

  /**
   * Apply the 3-layer tag-driven scoring pipeline:
   *  Layer 0: brand-filtered search to ensure matching-brand products are in the candidate pool
   *  Layer 1: model shortcut via db:search-by-model (if OCR extracted a model)
   *  Layer 2: tag-driven text boost (visual 0.2 + text 0.8) when hasTag
   *  Layer 3: default text boost (visual 0.6 + text 0.4) fallback
   */
  const applyTagDrivenScoring = useCallback(
    async (
      visualResults: SearchResult[],
      ocr: OcrFields | null,
      hasTag: boolean
    ): Promise<{ results: SearchResult[]; conflict: ConflictInfo | null }> => {
      cachedOcr.current = ocr
      let finalResults = [...visualResults]

      // Layer 0: brand-filtered search to inject matching-brand products into the pool
      if (ocr?.brand && cached.current.vectorPairs.length > 0) {
        try {
          const brandFilter: SearchFilter = { brand: ocr.brand }
          const v2Vectors = cached.current.vectorPairs.map((vp) => vp.v2Vector)
          const clipVectors = cached.current.vectorPairs.map((vp) => vp.clipVector)

          const brandResults: SearchResult[] = await window.api.searchHybridBatch(
            v2Vectors,
            clipVectors,
            10,
            brandFilter
          )

          console.log('[applyTagDrivenScoring] brand-filtered results:', brandResults.length, 'for brand:', ocr.brand)

          const existingIds = new Set(finalResults.map((r) => r.product.id))
          for (const br of brandResults) {
            if (!existingIds.has(br.product.id)) {
              finalResults.push(br)
              existingIds.add(br.product.id)
            }
          }
        } catch {
          console.warn('[applyTagDrivenScoring] brand-filtered search failed')
        }
      }

      // Layer 1: model shortcut
      if (hasTag && ocr?.model && ocr.model.trim()) {
        try {
          const modelResults: SearchResult[] = await window.api.searchByModel(ocr.model, 5)
          if (modelResults.length > 0) {
            finalResults = mergeModelResults(modelResults, finalResults)
          }
        } catch {
          // Model search failed, continue with visual results
        }
      }

      // Layer 2 or 3: text boost with appropriate weights
      finalResults = boostResultsWithText(finalResults, ocr, { hasTag })

      // Conflict detection
      const conflictInfo = detectConflict(visualResults, finalResults)
      setConflict(conflictInfo)
      setResults(finalResults)

      console.log('[applyTagDrivenScoring] final top-3:', finalResults.slice(0, 3).map((r) => ({
        id: r.product.id, brand: r.product.brand, sim: r.similarity, source: r.matchSource
      })))

      return { results: finalResults, conflict: conflictInfo }
    },
    []
  )

  const clearCache = useCallback(() => {
    cached.current = { vectorPairs: [], base64s: [] }
    cachedOcr.current = null
    setConflict(null)
  }, [])

  return {
    loading,
    progress,
    results,
    error,
    conflict,
    searchByImages,
    reSearchWithFilters,
    searchByFilters,
    searchByProductImages,
    applyTagDrivenScoring,
    clearCache,
    hasEmbeddings: cached.current.vectorPairs.length > 0
  }
}
