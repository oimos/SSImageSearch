import { useState, useEffect } from 'react'

export function useImageLoader(imagePaths: string[]) {
  const [images, setImages] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (imagePaths.length === 0) return

    setLoading(true)
    const loadAll = async (): Promise<void> => {
      const newImages = new Map<string, string>()
      for (const p of imagePaths) {
        try {
          const data = await window.api.readImage(p)
          if (data) newImages.set(p, data)
        } catch {
          /* skip failed loads */
        }
      }
      setImages(newImages)
      setLoading(false)
    }
    loadAll()
  }, [imagePaths.join(',')])

  return { images, loading }
}
