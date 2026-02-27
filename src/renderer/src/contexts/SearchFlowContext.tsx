import { createContext, useContext, useState, type ReactNode } from 'react'
import type { SearchResult, UploadedImage, ProductFormData } from '@shared/types'

interface SearchFlowState {
  uploadedImages: UploadedImage[]
  setUploadedImages: (images: UploadedImage[]) => void
  searchResults: SearchResult[]
  setSearchResults: (results: SearchResult[]) => void
  selectedCandidate: SearchResult | null
  setSelectedCandidate: (c: SearchResult | null) => void
  appliedFields: Partial<ProductFormData>
  setAppliedFields: (f: Partial<ProductFormData>) => void
  appliedFieldNames: Set<string>
  setAppliedFieldNames: (names: Set<string>) => void
  reset: () => void
}

const SearchFlowContext = createContext<SearchFlowState | null>(null)

export function SearchFlowProvider({ children }: { children: ReactNode }): JSX.Element {
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [selectedCandidate, setSelectedCandidate] = useState<SearchResult | null>(null)
  const [appliedFields, setAppliedFields] = useState<Partial<ProductFormData>>({})
  const [appliedFieldNames, setAppliedFieldNames] = useState<Set<string>>(new Set())

  const reset = (): void => {
    setUploadedImages([])
    setSearchResults([])
    setSelectedCandidate(null)
    setAppliedFields({})
    setAppliedFieldNames(new Set())
  }

  return (
    <SearchFlowContext.Provider
      value={{
        uploadedImages,
        setUploadedImages,
        searchResults,
        setSearchResults,
        selectedCandidate,
        setSelectedCandidate,
        appliedFields,
        setAppliedFields,
        appliedFieldNames,
        setAppliedFieldNames,
        reset
      }}
    >
      {children}
    </SearchFlowContext.Provider>
  )
}

export function useSearchFlow(): SearchFlowState {
  const ctx = useContext(SearchFlowContext)
  if (!ctx) throw new Error('useSearchFlow must be used within SearchFlowProvider')
  return ctx
}
