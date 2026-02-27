import { ipcMain } from 'electron'
import {
  getProducts,
  getRecentProducts,
  getProduct,
  saveProduct,
  getProductCount
} from '../services/productService'
import type { ProductFilter, ProductFormData } from '@shared/types'

export function registerProductHandlers(): void {
  ipcMain.handle('db:get-products', (_, filter?: ProductFilter) => {
    return getProducts(filter)
  })

  ipcMain.handle('db:get-recent-products', (_, limit?: number) => {
    return getRecentProducts(limit)
  })

  ipcMain.handle('db:get-product', (_, id: number) => {
    return getProduct(id)
  })

  ipcMain.handle(
    'db:save-product',
    (
      _,
      data: ProductFormData,
      imageRecords: Array<{ path: string; type: string; index: number }>
    ) => {
      return saveProduct(data, imageRecords)
    }
  )

  ipcMain.handle('db:get-product-count', () => {
    return getProductCount()
  })
}
