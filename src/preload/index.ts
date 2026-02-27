import { contextBridge, ipcRenderer } from 'electron'
import type { ProductFilter, ProductFormData } from '@shared/types'

const api = {
  getProducts: (filter?: ProductFilter) => ipcRenderer.invoke('db:get-products', filter),

  getRecentProducts: (limit?: number) => ipcRenderer.invoke('db:get-recent-products', limit),

  getProduct: (id: number) => ipcRenderer.invoke('db:get-product', id),

  saveProduct: (
    data: ProductFormData,
    imageRecords: Array<{ path: string; type: string; index: number }>
  ) => ipcRenderer.invoke('db:save-product', data, imageRecords),

  getProductCount: () => ipcRenderer.invoke('db:get-product-count'),

  searchSimilar: (vector: number[], limit?: number) =>
    ipcRenderer.invoke('db:search-similar', vector, limit),

  saveImages: (
    productId: number,
    images: Array<{ data: string; type: string; index: number }>
  ) => ipcRenderer.invoke('image:save', productId, images),

  readImage: (imagePath: string) => ipcRenderer.invoke('image:read', imagePath),

  saveVector: (imageId: number, productId: number, vector: number[]) =>
    ipcRenderer.invoke('db:save-vector', imageId, productId, vector),

  getAllVectors: () => ipcRenderer.invoke('db:get-all-vectors')
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
