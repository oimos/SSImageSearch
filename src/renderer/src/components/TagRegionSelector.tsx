import { useState, useRef, useCallback } from 'react'
import ReactCrop from 'react-image-crop'
import type { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

interface TagRegionSelectorProps {
  imageSrc: string
  onClose: () => void
  onOcrResult: (result: OcrExtractResult) => void
}

export interface OcrExtractResult {
  brand: string | null
  category: string | null
  model: string | null
  size: string | null
  material: string[] | null
  other_text: string[]
  confidence: number
}

export default function TagRegionSelector({
  imageSrc,
  onClose,
  onOcrResult
}: TagRegionSelectorProps): JSX.Element {
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [extracting, setExtracting] = useState(false)
  const [extractResult, setExtractResult] = useState<OcrExtractResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const getCroppedBase64 = useCallback(
    (pixelCrop: PixelCrop): string | null => {
      const image = imgRef.current
      if (!image) return null

      const scaleX = image.naturalWidth / image.width
      const scaleY = image.naturalHeight / image.height

      const canvas = document.createElement('canvas')
      canvas.width = pixelCrop.width * scaleX
      canvas.height = pixelCrop.height * scaleY

      const ctx = canvas.getContext('2d')
      if (!ctx) return null

      ctx.drawImage(
        image,
        pixelCrop.x * scaleX,
        pixelCrop.y * scaleY,
        pixelCrop.width * scaleX,
        pixelCrop.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      )

      return canvas.toDataURL('image/png')
    },
    []
  )

  const handleExtract = useCallback(async () => {
    if (!completedCrop || completedCrop.width < 10 || completedCrop.height < 10) {
      setError('タグ領域をドラッグで選択してください')
      return
    }

    const croppedBase64 = getCroppedBase64(completedCrop)
    if (!croppedBase64) {
      setError('画像のクロップに失敗しました')
      return
    }

    setExtracting(true)
    setError(null)

    try {
      const result = await window.api.extractFromImage(croppedBase64)
      if (result && result.confidence > 0) {
        setExtractResult(result)
      } else {
        setError('テキストを検出できませんでした。別の領域を選択してください。')
      }
    } catch {
      setError('テキスト抽出に失敗しました')
    } finally {
      setExtracting(false)
    }
  }, [completedCrop, getCroppedBase64])

  const handleApply = useCallback(() => {
    if (extractResult) {
      onOcrResult(extractResult)
    }
  }, [extractResult, onOcrResult])

  const handleExtractFullImage = useCallback(async () => {
    setExtracting(true)
    setError(null)
    setExtractResult(null)

    try {
      const result = await window.api.extractFromImage(imageSrc)
      if (result && result.confidence > 0) {
        setExtractResult(result)
      } else {
        setError('テキストを検出できませんでした')
      }
    } catch {
      setError('テキスト抽出に失敗しました')
    } finally {
      setExtracting(false)
    }
  }, [imageSrc])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative max-w-[90vw] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-white">タグ領域を選択</h3>
            <span className="text-2xs text-zinc-400">ドラッグでタグ部分を囲んでください</span>
          </div>
          <button
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            onClick={onClose}
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-auto rounded-xl bg-black flex items-center justify-center" style={{ maxHeight: '60vh' }}>
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            minWidth={20}
            minHeight={20}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              className="max-w-full max-h-[60vh] object-contain"
              crossOrigin="anonymous"
            />
          </ReactCrop>
        </div>

        <div className="flex items-center gap-2 mt-3 px-1">
          <button
            onClick={handleExtract}
            disabled={extracting || !completedCrop}
            className="btn-primary text-xs px-4 py-2 disabled:opacity-40"
          >
            {extracting ? (
              <span className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                抽出中...
              </span>
            ) : (
              '選択範囲からテキスト抽出'
            )}
          </button>

          <button
            onClick={handleExtractFullImage}
            disabled={extracting}
            className="text-xs px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-300 transition-colors disabled:opacity-40"
          >
            画像全体から抽出
          </button>

          <div className="flex-1" />

          {extractResult && (
            <button
              onClick={handleApply}
              className="text-xs px-4 py-2 rounded-lg bg-emerald-500/80 hover:bg-emerald-500 text-white font-medium transition-colors"
            >
              検索に適用
            </button>
          )}
        </div>

        {error && (
          <div className="mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
            <span className="text-xs text-red-400">{error}</span>
          </div>
        )}

        {extractResult && (
          <div className="mt-2 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10">
            <div className="text-2xs text-zinc-400 mb-1.5 font-medium">抽出結果</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {extractResult.brand && (
                <div>
                  <span className="text-zinc-500">ブランド: </span>
                  <span className="text-emerald-300 font-medium">{extractResult.brand}</span>
                </div>
              )}
              {extractResult.model && (
                <div>
                  <span className="text-zinc-500">型番: </span>
                  <span className="text-emerald-300 font-medium">{extractResult.model}</span>
                </div>
              )}
              {extractResult.category && (
                <div>
                  <span className="text-zinc-500">カテゴリ: </span>
                  <span className="text-zinc-300">{extractResult.category}</span>
                </div>
              )}
              {extractResult.size && (
                <div>
                  <span className="text-zinc-500">サイズ: </span>
                  <span className="text-zinc-300">{extractResult.size}</span>
                </div>
              )}
              {extractResult.material && extractResult.material.length > 0 && (
                <div>
                  <span className="text-zinc-500">素材: </span>
                  <span className="text-zinc-300">{extractResult.material.join(', ')}</span>
                </div>
              )}
              <div>
                <span className="text-zinc-500">信頼度: </span>
                <span className="text-zinc-300">{Math.round(extractResult.confidence * 100)}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
