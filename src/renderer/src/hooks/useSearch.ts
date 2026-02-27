import { useState, useCallback } from 'react'
import type { SearchResult } from '@shared/types'
import { generateEmbedding, fileToArrayBuffer } from '../lib/embedding'

export function useSearch() {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<SearchResult[]>([])
  const [error, setError] = useState<string | null>(null)

  const searchByImages = useCallback(async (files: File[], limit = 5): Promise<SearchResult[]> => {
    setLoading(true)
    setProgress(0)
    setError(null)
    setResults([])

    try {
      const validFiles = files.filter((f) => f.size > 0)
      if (validFiles.length === 0) {
        throw new Error('検索する画像を1枚以上選択してください')
      }

      const allResults = new Map<number, SearchResult>()

      for (let i = 0; i < validFiles.length; i++) {
        setProgress(Math.round(((i + 0.3) / validFiles.length) * 100))

        const buffer = await fileToArrayBuffer(validFiles[i])
        const embedding = await generateEmbedding(buffer)

        setProgress(Math.round(((i + 0.7) / validFiles.length) * 100))

        const searchResults: SearchResult[] = await window.api.searchSimilar(embedding, limit * 2)

        for (const result of searchResults) {
          const existing = allResults.get(result.product.id)
          if (!existing || result.similarity > existing.similarity) {
            allResults.set(result.product.id, result)
          }
        }
      }

      setProgress(100)

      const sorted = [...allResults.values()]
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)

      setResults(sorted)
      return sorted
    } catch (err) {
      const msg = err instanceof Error ? err.message : '検索中にエラーが発生しました'
      setError(msg)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

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

  return { loading, progress, results, error, searchByImages, searchByProductImages }
}
