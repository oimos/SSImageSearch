export interface OcrFixture {
  name: string
  input: string
  expected: {
    brand: string | null
    size: string | null
    material: string[] | null
    model: string | null
    hasOtherText: boolean
    minConfidence: number
  }
}

export const ocrFixtures: OcrFixture[] = [
  {
    name: 'normal brand tag (SUPREME)',
    input: 'SUPREME\nX L\n100% COTON\nMADE IN USA',
    expected: {
      brand: 'SUPREME',
      size: 'XL',
      material: ['COTTON'],
      model: null,
      hasOtherText: true,
      minConfidence: 0.7
    }
  },
  {
    name: 'size variation - single letter',
    input: 'GUCCI\nL\nSILK 100%',
    expected: {
      brand: 'GUCCI',
      size: 'L',
      material: ['SILK'],
      model: null,
      hasOtherText: false,
      minConfidence: 0.7
    }
  },
  {
    name: 'size variation - "Large" written out',
    input: 'PRADA\nLarge\nNYLON / LEATHER',
    expected: {
      brand: 'PRADA',
      size: null, // mock doesn't map "Large" → "L" but LLM would
      material: ['NYLON', 'LEATHER'],
      model: null,
      hasOtherText: false,
      minConfidence: 0.7
    }
  },
  {
    name: 'OCR typo - COTON → COTTON',
    input: '100% COTON\nMADE IN FRANCE',
    expected: {
      brand: null,
      size: null,
      material: ['COTTON'],
      model: null,
      hasOtherText: true,
      minConfidence: 0.0
    }
  },
  {
    name: 'no brand present',
    input: 'M\nPOLYESTER 65%\nCOTTON 35%\nMADE IN CHINA',
    expected: {
      brand: null,
      size: 'M',
      material: ['POLYESTER', 'COTTON'],
      model: null,
      hasOtherText: true,
      minConfidence: 0.0
    }
  },
  {
    name: 'heavy noise / garbled text',
    input: 'X#@!\n---\n???\nBURBERRY\n\n%%%SIZE:S%%%\n\nWOOL',
    expected: {
      brand: 'BURBERRY',
      size: 'S',
      material: ['WOOL'],
      model: null,
      hasOtherText: true,
      minConfidence: 0.5
    }
  },
  {
    name: 'empty input',
    input: '',
    expected: {
      brand: null,
      size: null,
      material: null,
      model: null,
      hasOtherText: false,
      minConfidence: 0.0
    }
  }
]
