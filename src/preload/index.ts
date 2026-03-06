import { contextBridge, ipcRenderer } from 'electron'
import type { ProductFilter, ProductFormData, SearchFilter, OcrNormalizeOptions } from '@shared/types'

const api = {
  getProducts: (filter?: ProductFilter) => ipcRenderer.invoke('db:get-products', filter),

  getRecentProducts: (limit?: number) => ipcRenderer.invoke('db:get-recent-products', limit),

  getProduct: (id: number) => ipcRenderer.invoke('db:get-product', id),

  saveProduct: (
    data: ProductFormData,
    imageRecords: Array<{ path: string; type: string; index: number }>
  ) => ipcRenderer.invoke('db:save-product', data, imageRecords),

  getProductCount: () => ipcRenderer.invoke('db:get-product-count'),

  searchSimilar: (vector: number[] | null, limit?: number, filters?: SearchFilter) =>
    ipcRenderer.invoke('db:search-similar', vector, limit, filters),

  saveImages: (
    productId: number,
    images: Array<{ data: string; type: string; index: number }>
  ) => ipcRenderer.invoke('image:save', productId, images),

  readImage: (imagePath: string) => ipcRenderer.invoke('image:read', imagePath),

  saveVector: (imageId: number, productId: number, vector: number[]) =>
    ipcRenderer.invoke('db:save-vector', imageId, productId, vector),

  getAllVectors: () => ipcRenderer.invoke('db:get-all-vectors'),

  normalizeOcr: (rawOcrText: string, options?: OcrNormalizeOptions) =>
    ipcRenderer.invoke('ocr:normalize', rawOcrText, options),

  generateVector: (imageBase64: string) =>
    ipcRenderer.invoke('image:generate-vector', imageBase64),

  generateVectors: (imageBase64: string) =>
    ipcRenderer.invoke('image:generate-vectors', imageBase64),

  searchHybrid: (
    v2Vector: number[] | null,
    clipVector: number[] | null,
    limit?: number,
    filters?: SearchFilter
  ) => ipcRenderer.invoke('db:search-hybrid', v2Vector, clipVector, limit, filters),

  searchHybridBatch: (
    v2Vectors: number[][],
    clipVectors: (number[] | null)[],
    limit?: number,
    filters?: SearchFilter
  ) => ipcRenderer.invoke('db:search-hybrid-batch', v2Vectors, clipVectors, limit, filters),

  clipStatus: () => ipcRenderer.invoke('clip:status'),

  extractFromImage: (imageBase64: string) =>
    ipcRenderer.invoke('ocr:extract-from-image', imageBase64),

  classifyImageType: (imageBase64: string) =>
    ipcRenderer.invoke('image:classify-type', imageBase64),

  searchByModel: (ocrModel: string, limit?: number) =>
    ipcRenderer.invoke('db:search-by-model', ocrModel, limit)
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
