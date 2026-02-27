import { useState, useEffect, useCallback } from 'react'
import type { Product, ProductImage, ProductFilter } from '@shared/types'

export function useRecentProducts(limit = 5) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await window.api.getRecentProducts(limit)
      setProducts(data)
    } catch (err) {
      console.error('Failed to load recent products:', err)
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { products, loading, refresh }
}

export function useProducts(filter?: ProductFilter) {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await window.api.getProducts(filter)
      setProducts(data.products)
      setTotal(data.total)
    } catch (err) {
      console.error('Failed to load products:', err)
    } finally {
      setLoading(false)
    }
  }, [filter?.brand, filter?.category, filter?.page, filter?.limit])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { products, total, loading, refresh }
}

export function useProduct(id: number | null) {
  const [product, setProduct] = useState<Product | null>(null)
  const [images, setImages] = useState<ProductImage[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (id === null) return
    setLoading(true)
    window.api
      .getProduct(id)
      .then((data) => {
        if (data) {
          setProduct(data.product)
          setImages(data.images)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  return { product, images, loading }
}
