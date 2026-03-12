/**
 * CLIP-based image feature extraction using @huggingface/transformers.
 *
 * Lazy-loads the model on first use (~85 MB download, cached locally).
 * Falls back gracefully if ONNX runtime is unavailable.
 */

import { app } from 'electron'
import path from 'path'
import sharp from 'sharp'

export const CLIP_DIM = 512
export const CLIP_MODEL_NAME = 'clip-vit-b32'

type CLIPPipeline = {
  (images: unknown, options?: { pooling?: string; normalize?: boolean }): Promise<{
    tolist(): number[][]
  }>
}

let _pipeline: CLIPPipeline | null = null
let _loading: Promise<CLIPPipeline | null> | null = null
let _loadError: string | null = null

function getCacheDir(): string {
  return path.join(app.getPath('userData'), 'models')
}

async function loadPipeline(): Promise<CLIPPipeline | null> {
  try {
    const { pipeline, env, RawImage } = await import('@huggingface/transformers')
    env.cacheDir = getCacheDir()
    // Store RawImage for later use
    ;(globalThis as Record<string, unknown>).__RawImage = RawImage

    console.log(`[CLIP] Loading model (cache: ${env.cacheDir})...`)
    const extractor = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32', {
      dtype: 'fp32'
    })
    console.log('[CLIP] Model loaded successfully')
    return extractor as unknown as CLIPPipeline
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[CLIP] Failed to load model: ${msg}`)
    _loadError = msg
    return null
  }
}

export async function initCLIP(): Promise<boolean> {
  if (_pipeline) return true
  if (_loading) {
    _pipeline = await _loading
    return _pipeline !== null
  }
  _loading = loadPipeline()
  _pipeline = await _loading
  _loading = null
  return _pipeline !== null
}

export function getCLIPError(): string | null {
  return _loadError
}

export function isCLIPReady(): boolean {
  return _pipeline !== null
}

function l2Normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0))
  if (norm === 0) return vec
  return vec.map((x) => x / norm)
}

type RawImageConstructor = new (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  channels: number
) => unknown

async function sharpToRawImage(input: string | Buffer): Promise<unknown> {
  const RawImage = (globalThis as Record<string, unknown>).__RawImage as RawImageConstructor
  const { data, info } = await sharp(input)
    .resize(224, 224, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  return new RawImage(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), info.width, info.height, info.channels)
}

/**
 * Extract a 512-dim CLIP embedding from an image file.
 * Returns null if CLIP model is not available.
 */
export async function extractCLIPFromFile(filePath: string): Promise<number[] | null> {
  if (!_pipeline) {
    const ready = await initCLIP()
    if (!ready) return null
  }

  try {
    const image = await sharpToRawImage(filePath)

    const result = await _pipeline!(image, { pooling: 'mean', normalize: true })
    const vectors = result.tolist()

    if (vectors.length === 0 || vectors[0].length === 0) {
      console.warn('[CLIP] Empty result')
      return null
    }

    return l2Normalize(vectors[0])
  } catch (err) {
    console.error('[CLIP] Extraction failed:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Extract CLIP embedding from raw image buffer (for renderer-sent data).
 */
export async function extractCLIPFromBuffer(buffer: Buffer): Promise<number[] | null> {
  if (!_pipeline) {
    const ready = await initCLIP()
    if (!ready) return null
  }

  try {
    const image = await sharpToRawImage(buffer)

    const result = await _pipeline!(image, { pooling: 'mean', normalize: true })
    const vectors = result.tolist()

    if (vectors.length === 0 || vectors[0].length === 0) return null
    return l2Normalize(vectors[0])
  } catch (err) {
    console.error('[CLIP] Buffer extraction failed:', err instanceof Error ? err.message : err)
    return null
  }
}
