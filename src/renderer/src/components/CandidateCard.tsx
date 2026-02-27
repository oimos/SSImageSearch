import { useState, useEffect } from 'react'
import type { SearchResult } from '@shared/types'
import SimilarityBar from './SimilarityBar'

interface CandidateCardProps {
  result: SearchResult
  rank: number
  onSelect: () => void
  onDetail: () => void
}

export default function CandidateCard({
  result,
  rank,
  onSelect,
  onDetail
}: CandidateCardProps): JSX.Element {
  const { product, images, similarity, matchReasons } = result
  const [thumbnail, setThumbnail] = useState<string | null>(null)

  useEffect(() => {
    if (images.length > 0) {
      window.api.readImage(images[0].image_path).then((data) => {
        if (data) setThumbnail(data)
      })
    }
  }, [images])

  return (
    <div className="card hover:shadow-md transition-shadow duration-200">
      <div className="flex">
        <div className="w-32 h-32 bg-surface-3 shrink-0 flex items-center justify-center">
          {thumbnail ? (
            <img src={thumbnail} alt={product.model} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-txt-muted text-xs">
              No Image
            </div>
          )}
        </div>

        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent-muted text-accent-text text-xs font-bold shrink-0">
                  {rank}
                </span>
                <h3 className="font-semibold text-txt-primary truncate">{product.brand}</h3>
              </div>
              <p className="text-sm text-txt-secondary truncate">{product.model}</p>
            </div>
            <span className="text-xs bg-surface-3 text-txt-secondary px-2 py-0.5 rounded-full shrink-0">
              {product.category}
            </span>
          </div>

          <div className="mb-2">
            <SimilarityBar score={similarity} />
          </div>

          <div className="flex flex-wrap gap-1 mb-3">
            {matchReasons.map((reason, i) => (
              <span
                key={i}
                className="text-xs bg-accent-muted text-accent-text px-1.5 py-0.5 rounded"
              >
                {reason}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onSelect} className="btn-primary text-xs py-1.5 px-3">
              この候補を使う
            </button>
            <button onClick={onDetail} className="btn-secondary text-xs py-1.5 px-3">
              詳細
            </button>
            <span className="text-sm font-medium text-txt-primary ml-auto">
              ¥{product.price.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
