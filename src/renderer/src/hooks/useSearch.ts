import { useState, useCallback, useRef } from 'react'
import type { SearchResult, SearchFilter } from '@shared/types'
import { generateEmbedding, fileToArrayBuffer, fileToBase64 } from '../lib/embedding'

interface CachedVectors {
  v2: number[][]
  clipBase64: string[]
}

export function useSearch() {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<SearchResult[]>([])
  const [error, setError] = useState<string | null>(null)

  const cachedVectors = useRef<CachedVectors>({ v2: [], clipBase64: [] })

  const mergeAndSort = (
    allResults: Map<number, SearchResult>,
    limit: number
  ): SearchResult[] => {
    return [...allResults.values()]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
  }

  const hybridSearch = useCallback(
    async (
      v2Embeddings: number[][],
      clipBase64s: string[],
      limit: number,
      filters?: SearchFilter
    ): Promise<SearchResult[]> => {
      // Extract CLIP vectors for all images
      const clipVectors: (number[] | null)[] = []
      for (const base64 of clipBase64s) {
        if (!base64) {
          clipVectors.push(null)
          continue
        }
        try {
          const vec = await window.api.extractCLIP(base64)
          clipVectors.push(vec)
        } catch {
          clipVectors.push(null)
        }
      }

      // Use batch hybrid search for multi-photo aggregation with consistency penalty
      if (v2Embeddings.length > 1) {
        try {
          return await window.api.searchHybridBatch(
            v2Embeddings,
            clipVectors,
            limit,
            filters
          )
        } catch {
          /* fallback to sequential below */
        }
      }

      // Single image or fallback: use per-image search
      const allResults = new Map<number, SearchResult>()
      for (let i = 0; i < v2Embeddings.length; i++) {
        const clipVec = clipVectors[i]
        let searchResults: SearchResult[]
        if (clipVec) {
          searchResults = await window.api.searchHybrid(
            v2Embeddings[i], clipVec, limit * 2, filters
          )
        } else {
          searchResults = await window.api.searchSimilar(
            v2Embeddings[i], limit * 2, filters
          )
        }
        for (const result of searchResults) {
          const existing = allResults.get(result.product.id)
          if (!existing || result.similarity > existing.similarity) {
            allResults.set(result.product.id, result)
          }
        }
      }
      return mergeAndSort(allResults, limit)
    },
    []
  )

  const searchByImages = useCallback(
    async (files: File[], limit = 10, filters?: SearchFilter): Promise<SearchResult[]> => {
      setLoading(true)
      setProgress(0)
      setError(null)
      setResults([])

      try {
        const validFiles = files.filter((f) => f.size > 0)
        if (validFiles.length === 0) {
          throw new Error('検索する画像を1枚以上選択してください')
        }

        const v2Embeddings: number[][] = []
        const clipBase64s: string[] = []

        for (let i = 0; i < validFiles.length; i++) {
          setProgress(Math.round(((i + 0.2) / validFiles.length) * 100))

          const buffer = await fileToArrayBuffer(validFiles[i])
          const v2 = await generateEmbedding(buffer)
          v2Embeddings.push(v2)

          setProgress(Math.round(((i + 0.5) / validFiles.length) * 100))

          const base64 = await fileToBase64(validFiles[i])
          clipBase64s.push(base64)

          setProgress(Math.round(((i + 0.8) / validFiles.length) * 100))
        }

        cachedVectors.current = { v2: v2Embeddings, clipBase64: clipBase64s }

        const sorted = await hybridSearch(v2Embeddings, clipBase64s, limit, filters)
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
    [hybridSearch]
  )

  const reSearchWithFilters = useCallback(
    async (filters?: SearchFilter, limit = 10): Promise<SearchResult[]> => {
      const { v2, clipBase64 } = cachedVectors.current
      if (v2.length === 0) return []

      setLoading(true)
      setError(null)

      try {
        const sorted = await hybridSearch(v2, clipBase64, limit, filters)
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
    [hybridSearch]
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

        const response = await fetch(base64)
        const buffer = await response.arrayBuffer()
        const embedding = await generateEmbedding(buffer)

        const searchResults: SearchResult[] = await window.api.searchSimilar(embedding, limit)
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

  const clearCache = useCallback(() => {
    cachedVectors.current = { v2: [], clipBase64: [] }
  }, [])

  return {
    loading,
    progress,
    results,
    error,
    searchByImages,
    reSearchWithFilters,
    searchByFilters,
    searchByProductImages,
    clearCache,
    hasEmbeddings: cachedVectors.current.v2.length > 0
  }
}
