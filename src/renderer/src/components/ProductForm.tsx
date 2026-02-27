import type { ProductFormData } from '@shared/types'
import { BRANDS, CATEGORIES, CONDITIONS } from '@shared/types'
import ConfidenceBadge from './ConfidenceBadge'

interface ProductFormProps {
  data: ProductFormData
  onChange: (data: ProductFormData) => void
  appliedFieldNames?: Set<string>
  fieldConfidences?: Record<string, number>
  disabled?: boolean
}

const FIELD_LABELS: Record<keyof ProductFormData, string> = {
  brand: 'ブランド',
  category: 'カテゴリ',
  model: '型番・モデル名',
  size: 'サイズ',
  color: '色',
  material: '素材',
  condition: '状態ランク',
  price: '買取価格（円）',
  notes: '備考'
}

export default function ProductForm({
  data,
  onChange,
  appliedFieldNames = new Set(),
  fieldConfidences = {},
  disabled = false
}: ProductFormProps): JSX.Element {
  const update = (field: keyof ProductFormData, value: string | number): void => {
    onChange({ ...data, [field]: value })
  }

  const renderBadge = (field: string): JSX.Element | null => {
    if (appliedFieldNames.has(field)) {
      return <ConfidenceBadge confidence={fieldConfidences[field] || 0.5} isApplied />
    }
    return null
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="label mb-0">{FIELD_LABELS.brand}</label>
          {renderBadge('brand')}
        </div>
        <input
          type="text"
          className="input-field"
          value={data.brand}
          onChange={(e) => update('brand', e.target.value)}
          disabled={disabled}
          list="brand-list"
          placeholder="例: GUCCI"
        />
        <datalist id="brand-list">
          {BRANDS.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="label mb-0">{FIELD_LABELS.category}</label>
          {renderBadge('category')}
        </div>
        <select
          className="input-field"
          value={data.category}
          onChange={(e) => update('category', e.target.value)}
          disabled={disabled}
        >
          <option value="">選択してください</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="col-span-2">
        <div className="flex items-center gap-2 mb-1">
          <label className="label mb-0">{FIELD_LABELS.model}</label>
          {renderBadge('model')}
        </div>
        <input
          type="text"
          className="input-field"
          value={data.model}
          onChange={(e) => update('model', e.target.value)}
          disabled={disabled}
          placeholder="例: GG Marmont ショルダーバッグ"
        />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="label mb-0">{FIELD_LABELS.size}</label>
          {renderBadge('size')}
        </div>
        <input
          type="text"
          className="input-field"
          value={data.size}
          onChange={(e) => update('size', e.target.value)}
          disabled={disabled}
          placeholder="例: M, FREE, 26.0"
        />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="label mb-0">{FIELD_LABELS.color}</label>
          {renderBadge('color')}
        </div>
        <input
          type="text"
          className="input-field"
          value={data.color}
          onChange={(e) => update('color', e.target.value)}
          disabled={disabled}
          placeholder="例: ブラック"
        />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="label mb-0">{FIELD_LABELS.material}</label>
          {renderBadge('material')}
        </div>
        <input
          type="text"
          className="input-field"
          value={data.material}
          onChange={(e) => update('material', e.target.value)}
          disabled={disabled}
          placeholder="例: レザー"
        />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="label mb-0">{FIELD_LABELS.condition}</label>
          {renderBadge('condition')}
        </div>
        <select
          className="input-field"
          value={data.condition}
          onChange={(e) => update('condition', e.target.value)}
          disabled={disabled}
        >
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {c}ランク
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="label mb-0">{FIELD_LABELS.price}</label>
          {renderBadge('price')}
        </div>
        <input
          type="number"
          className="input-field"
          value={data.price || ''}
          onChange={(e) => update('price', parseInt(e.target.value) || 0)}
          disabled={disabled}
          placeholder="例: 50000"
          min={0}
        />
      </div>

      <div className="col-span-2">
        <div className="flex items-center gap-2 mb-1">
          <label className="label mb-0">{FIELD_LABELS.notes}</label>
          {renderBadge('notes')}
        </div>
        <textarea
          className="input-field min-h-[80px] resize-y"
          value={data.notes}
          onChange={(e) => update('notes', e.target.value)}
          disabled={disabled}
          placeholder="状態の詳細、付属品の有無など"
          rows={3}
        />
      </div>
    </div>
  )
}
