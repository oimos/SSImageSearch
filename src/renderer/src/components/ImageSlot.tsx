import { useRef } from 'react'
import { IMAGE_TYPE_LABELS, type ImageType } from '@shared/types'

interface ImageSlotProps {
  index: number
  preview: string | null
  imageType: ImageType
  onImageSelect: (file: File) => void
  onTypeChange: (type: ImageType) => void
  onRemove: () => void
}

export default function ImageSlot({
  index,
  preview,
  imageType,
  onImageSelect,
  onTypeChange,
  onRemove
}: ImageSlotProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClick = (): void => {
    inputRef.current?.click()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (file) onImageSelect(file)
  }

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) onImageSelect(file)
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`relative w-full aspect-square rounded-xl border-2 border-dashed cursor-pointer
          transition-all duration-200 overflow-hidden group
          ${preview ? 'border-accent/40 bg-accent-muted' : 'border-border bg-surface-2 hover:border-accent/40 hover:bg-accent-muted'}`}
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
        />

        {preview ? (
          <>
            <img src={preview} alt={`画像 ${index + 1}`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <span className="text-white opacity-0 group-hover:opacity-100 text-sm font-medium">
                差し替え
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full
                         flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-txt-muted">
            <svg className="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
            <span className="text-xs">画像 {index + 1}</span>
          </div>
        )}
      </div>

      <select
        value={imageType}
        onChange={(e) => onTypeChange(e.target.value as ImageType)}
        className="input-field text-xs py-1.5"
      >
        {Object.entries(IMAGE_TYPE_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </div>
  )
}
