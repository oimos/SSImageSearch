/**
 * V2 Feature Extraction — 768-dimensional embedding
 *
 * Layout:
 *   [  0..191]  Spatial color grid          (4×4 cells × 12 features)
 *   [192..407]  HSV spatial pyramid          (24 + 96 + 96)
 *   [408..551]  Gradient orientation / HOG   (4×4 cells × 9 bins)
 *   [552..615]  Edge spatial map             (8×8 mean magnitudes)
 *   [616..743]  Texture LBP                  (4×4 cells × 8 bins)
 *   [744..767]  Global statistics            (24 features)
 *
 * This module is pure TypeScript — no Sharp or Canvas dependency.
 * Both main (Sharp) and renderer (Canvas) feed raw 64×64 RGB pixels here.
 */

export const GRID_V2 = 64
export const FEATURE_DIM_V2 = 768

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _gaussianWeights: Float64Array | null = null

function gaussianWeights(): Float64Array {
  if (_gaussianWeights) return _gaussianWeights
  const sigma = 20
  const cx = GRID_V2 / 2
  const cy = GRID_V2 / 2
  const w = new Float64Array(GRID_V2 * GRID_V2)
  for (let y = 0; y < GRID_V2; y++) {
    for (let x = 0; x < GRID_V2; x++) {
      const dx = x - cx
      const dy = y - cy
      w[y * GRID_V2 + x] = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma))
    }
  }
  _gaussianWeights = w
  return w
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rf = r / 255
  const gf = g / 255
  const bf = b / 255
  const max = Math.max(rf, gf, bf)
  const min = Math.min(rf, gf, bf)
  const d = max - min

  let h = 0
  if (d > 0) {
    if (max === rf) h = ((gf - bf) / d + 6) % 6
    else if (max === gf) h = (bf - rf) / d + 2
    else h = (rf - gf) / d + 4
    h /= 6
  }
  const s = max === 0 ? 0 : d / max
  return [h, s, max]
}

function l2Normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0))
  if (norm === 0) return vec
  return vec.map((x) => x / norm)
}

// ---------------------------------------------------------------------------
// A. Spatial Color Grid — 192 dims (4×4 grid, 12 features per cell)
// ---------------------------------------------------------------------------

function spatialColorGrid(
  rgb: Uint8Array,
  W: number,
  H: number,
  gw: Float64Array
): number[] {
  const cellW = W / 4
  const cellH = H / 4
  const features: number[] = []

  for (let cy = 0; cy < 4; cy++) {
    for (let cx = 0; cx < 4; cx++) {
      let wSum = 0
      let sr = 0, sg = 0, sb = 0
      let sh = 0, ss = 0, sv = 0
      const rVals: number[] = []
      const gVals: number[] = []
      const bVals: number[] = []

      for (let dy = 0; dy < cellH; dy++) {
        for (let dx = 0; dx < cellW; dx++) {
          const px = Math.floor(cx * cellW + dx)
          const py = Math.floor(cy * cellH + dy)
          const idx = py * W + px
          const w = gw[idx]

          const r = rgb[idx * 3]
          const g = rgb[idx * 3 + 1]
          const b = rgb[idx * 3 + 2]

          sr += r * w; sg += g * w; sb += b * w
          wSum += w

          const [h, saturation, value] = rgbToHsv(r, g, b)
          sh += h * w; ss += saturation * w; sv += value * w

          rVals.push(r)
          gVals.push(g)
          bVals.push(b)
        }
      }

      if (wSum === 0) wSum = 1
      const meanR = sr / wSum
      const meanG = sg / wSum
      const meanB = sb / wSum

      let varR = 0, varG = 0, varB = 0
      for (let i = 0; i < rVals.length; i++) {
        varR += (rVals[i] - meanR) ** 2
        varG += (gVals[i] - meanG) ** 2
        varB += (bVals[i] - meanB) ** 2
      }
      const n = rVals.length || 1
      const stdR = Math.sqrt(varR / n) / 128
      const stdG = Math.sqrt(varG / n) / 128
      const stdB = Math.sqrt(varB / n) / 128

      features.push(
        meanR / 128 - 1, meanG / 128 - 1, meanB / 128 - 1,
        stdR, stdG, stdB,
        sh / wSum, ss / wSum, sv / wSum,
        Math.sqrt(stdR * stdR + stdG * stdG + stdB * stdB),
        ss / wSum > 0.3 ? 1 : 0,
        sv / wSum > 0.5 ? 1 : 0
      )
    }
  }
  return features // 16 × 12 = 192
}

// ---------------------------------------------------------------------------
// B. HSV Spatial Pyramid — 216 dims
// ---------------------------------------------------------------------------

function buildHueHistogram(
  rgb: Uint8Array,
  W: number,
  x0: number, y0: number, x1: number, y1: number,
  hueBins: number,
  satLevels: number,
  gw: Float64Array
): number[] {
  const bins = new Float64Array(hueBins * satLevels)
  let total = 0

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = y * W + x
      const w = gw[idx]
      const r = rgb[idx * 3]
      const g = rgb[idx * 3 + 1]
      const b = rgb[idx * 3 + 2]
      const [h, s] = rgbToHsv(r, g, b)

      if (s < 0.05) continue // skip achromatic

      const hBin = Math.min(Math.floor(h * hueBins), hueBins - 1)
      const sBin = satLevels > 1 ? Math.min(Math.floor(s * satLevels), satLevels - 1) : 0
      bins[sBin * hueBins + hBin] += w
      total += w
    }
  }

  if (total > 0) {
    for (let i = 0; i < bins.length; i++) bins[i] /= total
  }
  return Array.from(bins)
}

function hsvSpatialPyramid(
  rgb: Uint8Array,
  W: number,
  H: number,
  gw: Float64Array
): number[] {
  const features: number[] = []

  // Level 0 (1×1): 12 hue × 2 sat = 24
  features.push(...buildHueHistogram(rgb, W, 0, 0, W, H, 12, 2, gw))

  // Level 1 (2×2): 4 regions × (12 hue × 2 sat) = 96
  const hw = W / 2, hh = H / 2
  for (let ry = 0; ry < 2; ry++) {
    for (let rx = 0; rx < 2; rx++) {
      features.push(
        ...buildHueHistogram(
          rgb, W,
          Math.floor(rx * hw), Math.floor(ry * hh),
          Math.floor((rx + 1) * hw), Math.floor((ry + 1) * hh),
          12, 2, gw
        )
      )
    }
  }

  // Level 2 (4×4): 16 regions × 6 hue bins = 96
  const qw = W / 4, qh = H / 4
  for (let ry = 0; ry < 4; ry++) {
    for (let rx = 0; rx < 4; rx++) {
      features.push(
        ...buildHueHistogram(
          rgb, W,
          Math.floor(rx * qw), Math.floor(ry * qh),
          Math.floor((rx + 1) * qw), Math.floor((ry + 1) * qh),
          6, 1, gw
        )
      )
    }
  }

  return features // 24 + 96 + 96 = 216
}

// ---------------------------------------------------------------------------
// C. Gradient Orientation Histograms (HOG-like) — 144 dims
// ---------------------------------------------------------------------------

function gradientHistograms(
  gx: Float64Array,
  gy: Float64Array,
  W: number,
  H: number
): number[] {
  const BINS = 9
  const cellW = W / 4
  const cellH = H / 4
  const features: number[] = []

  for (let cy = 0; cy < 4; cy++) {
    for (let cx = 0; cx < 4; cx++) {
      const hist = new Float64Array(BINS)

      for (let dy = 0; dy < cellH; dy++) {
        for (let dx = 0; dx < cellW; dx++) {
          const px = Math.floor(cx * cellW + dx)
          const py = Math.floor(cy * cellH + dy)
          const idx = py * W + px
          const mag = Math.sqrt(gx[idx] ** 2 + gy[idx] ** 2)
          if (mag < 1e-6) continue

          // Unsigned orientation 0..180
          let angle = Math.atan2(Math.abs(gy[idx]), Math.abs(gx[idx])) * (180 / Math.PI)
          if (angle >= 180) angle -= 180
          const bin = Math.min(Math.floor(angle / (180 / BINS)), BINS - 1)
          hist[bin] += mag
        }
      }

      // L2-normalize per cell
      const norm = Math.sqrt(hist.reduce((s, v) => s + v * v, 0))
      for (let i = 0; i < BINS; i++) {
        features.push(norm > 0 ? hist[i] / norm : 0)
      }
    }
  }
  return features // 16 × 9 = 144
}

// ---------------------------------------------------------------------------
// D. Edge Spatial Map — 64 dims (8×8 downsampled magnitude)
// ---------------------------------------------------------------------------

function edgeSpatialMap(
  gx: Float64Array,
  gy: Float64Array,
  W: number,
  H: number
): number[] {
  const blockW = W / 8
  const blockH = H / 8
  const features: number[] = []
  let maxMag = 0

  const mags = new Float64Array(64)
  for (let by = 0; by < 8; by++) {
    for (let bx = 0; bx < 8; bx++) {
      let sum = 0
      let count = 0
      for (let dy = 0; dy < blockH; dy++) {
        for (let dx = 0; dx < blockW; dx++) {
          const px = Math.floor(bx * blockW + dx)
          const py = Math.floor(by * blockH + dy)
          const idx = py * W + px
          sum += Math.sqrt(gx[idx] ** 2 + gy[idx] ** 2)
          count++
        }
      }
      const mean = count > 0 ? sum / count : 0
      mags[by * 8 + bx] = mean
      if (mean > maxMag) maxMag = mean
    }
  }

  if (maxMag > 0) {
    for (let i = 0; i < 64; i++) features.push(mags[i] / maxMag)
  } else {
    for (let i = 0; i < 64; i++) features.push(0)
  }

  return features // 64
}

// ---------------------------------------------------------------------------
// E. Texture LBP — 128 dims (4×4 grid, 8 bins per cell)
// ---------------------------------------------------------------------------

//  4-bit pattern: compare center to up, right, down, left neighbors
//  Bin mapping by popcount + adjacency:
//  0: flat (0000)          5: peak (1111)
//  1: single-edge          6: vertical edge (up or down only)
//  2: corner (2 adj bits)  7: horizontal edge (left or right only)
//  3: line (2 opp bits)    4: valley (3 bits set)
const LBP_BIN: readonly number[] = [
  0, 7, 6, 2, 7, 3, 2, 4, 6, 2, 3, 4, 2, 4, 4, 5
]

function textureLBP(gray: Float64Array, W: number, H: number): number[] {
  const BINS = 8
  const cellW = W / 4
  const cellH = H / 4
  const features: number[] = []

  for (let cy = 0; cy < 4; cy++) {
    for (let cx = 0; cx < 4; cx++) {
      const hist = new Float64Array(BINS)
      let count = 0

      for (let dy = 1; dy < cellH - 1; dy++) {
        for (let dx = 1; dx < cellW - 1; dx++) {
          const px = Math.floor(cx * cellW + dx)
          const py = Math.floor(cy * cellH + dy)
          if (px <= 0 || px >= W - 1 || py <= 0 || py >= H - 1) continue

          const idx = py * W + px
          const c = gray[idx]
          let pattern = 0
          if (c > gray[(py - 1) * W + px]) pattern |= 8 // up
          if (c > gray[py * W + (px + 1)]) pattern |= 4 // right
          if (c > gray[(py + 1) * W + px]) pattern |= 2 // down
          if (c > gray[py * W + (px - 1)]) pattern |= 1 // left

          hist[LBP_BIN[pattern]] += 1
          count++
        }
      }

      if (count > 0) {
        for (let i = 0; i < BINS; i++) features.push(hist[i] / count)
      } else {
        for (let i = 0; i < BINS; i++) features.push(0)
      }
    }
  }

  return features // 16 × 8 = 128
}

// ---------------------------------------------------------------------------
// F. Global Statistics — 24 dims
// ---------------------------------------------------------------------------

function globalStats(
  rgb: Uint8Array,
  gray: Float64Array,
  gx: Float64Array,
  gy: Float64Array,
  W: number,
  H: number,
  gw: Float64Array
): number[] {
  const n = W * H
  const features: number[] = []

  // Weighted mean & std for R, G, B (6 dims)
  let wSum = 0
  let sr = 0, sg = 0, sb = 0
  for (let i = 0; i < n; i++) {
    const w = gw[i]
    sr += rgb[i * 3] * w
    sg += rgb[i * 3 + 1] * w
    sb += rgb[i * 3 + 2] * w
    wSum += w
  }
  if (wSum === 0) wSum = 1
  const mR = sr / wSum, mG = sg / wSum, mB = sb / wSum
  let vR = 0, vG = 0, vB = 0
  for (let i = 0; i < n; i++) {
    const w = gw[i]
    vR += (rgb[i * 3] - mR) ** 2 * w
    vG += (rgb[i * 3 + 1] - mG) ** 2 * w
    vB += (rgb[i * 3 + 2] - mB) ** 2 * w
  }
  const sR = Math.sqrt(vR / wSum) / 128
  const sG = Math.sqrt(vG / wSum) / 128
  const sB = Math.sqrt(vB / wSum) / 128
  features.push(mR / 128 - 1, mG / 128 - 1, mB / 128 - 1, sR, sG, sB)

  // Skewness for R, G, B (3 dims)
  let skR = 0, skG = 0, skB = 0
  for (let i = 0; i < n; i++) {
    skR += ((rgb[i * 3] - mR) / 128) ** 3
    skG += ((rgb[i * 3 + 1] - mG) / 128) ** 3
    skB += ((rgb[i * 3 + 2] - mB) / 128) ** 3
  }
  const dR = sR ** 3 * n || 1
  const dG = sG ** 3 * n || 1
  const dB = sB ** 3 * n || 1
  features.push(skR / dR, skG / dG, skB / dB)

  // Mean, std for H, S, V (6 dims)
  let sH = 0, sS = 0, sV = 0
  const hVals: number[] = []
  const sVals: number[] = []
  const vVals: number[] = []
  for (let i = 0; i < n; i++) {
    const [h, s, v] = rgbToHsv(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2])
    sH += h; sS += s; sV += v
    hVals.push(h); sVals.push(s); vVals.push(v)
  }
  const mH = sH / n, mS = sS / n, mV = sV / n
  let vH = 0, vSat = 0, vVal = 0
  for (let i = 0; i < n; i++) {
    vH += (hVals[i] - mH) ** 2
    vSat += (sVals[i] - mS) ** 2
    vVal += (vVals[i] - mV) ** 2
  }
  features.push(mH, mS, mV)
  features.push(Math.sqrt(vH / n), Math.sqrt(vSat / n), Math.sqrt(vVal / n))

  // Edge density (1 dim)
  let magSum = 0
  for (let i = 0; i < n; i++) {
    magSum += Math.sqrt(gx[i] ** 2 + gy[i] ** 2)
  }
  features.push(magSum / (n * 255))

  // Edge concentration — std of 4×4 block edge densities (1 dim)
  const blockDensities: number[] = []
  const bw = W / 4, bh = H / 4
  for (let by = 0; by < 4; by++) {
    for (let bx = 0; bx < 4; bx++) {
      let bs = 0, bc = 0
      for (let dy = 0; dy < bh; dy++) {
        for (let dx = 0; dx < bw; dx++) {
          const idx = Math.floor(by * bh + dy) * W + Math.floor(bx * bw + dx)
          bs += Math.sqrt(gx[idx] ** 2 + gy[idx] ** 2)
          bc++
        }
      }
      blockDensities.push(bc > 0 ? bs / bc : 0)
    }
  }
  const meanBd = blockDensities.reduce((a, b) => a + b, 0) / blockDensities.length
  const varBd = blockDensities.reduce((a, b) => a + (b - meanBd) ** 2, 0) / blockDensities.length
  features.push(Math.sqrt(varBd) / 255)

  // Color diversity — # of 12 hue bins with >5% pixels (1 dim)
  const hueCounts = new Float64Array(12)
  let chromatic = 0
  for (let i = 0; i < n; i++) {
    const [h, s] = rgbToHsv(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2])
    if (s < 0.05) continue
    hueCounts[Math.min(Math.floor(h * 12), 11)] += 1
    chromatic++
  }
  let diversity = 0
  if (chromatic > 0) {
    for (let i = 0; i < 12; i++) {
      if (hueCounts[i] / chromatic > 0.05) diversity++
    }
  }
  features.push(diversity / 12)

  // Brightness uniformity (1 dim)
  const meanGray = gray.reduce((a, b) => a + b, 0) / n
  let grayVar = 0
  for (let i = 0; i < n; i++) grayVar += (gray[i] - meanGray) ** 2
  features.push(1 - Math.sqrt(grayVar / n) / (meanGray || 1))

  // Saturation concentration (1 dim)
  features.push(mS)

  // Contrast — gray range / 255 (1 dim)
  let minG = 255, maxG = 0
  for (let i = 0; i < n; i++) {
    if (gray[i] < minG) minG = gray[i]
    if (gray[i] > maxG) maxG = gray[i]
  }
  features.push((maxG - minG) / 255)

  // Padding to 24 (3 dims)
  features.push(0, 0, 0)

  return features // 6 + 3 + 6 + 1 + 1 + 1 + 1 + 1 + 1 + 3 = 24
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract a 768-dim feature vector from raw 64×64 RGB pixel data.
 *
 * @param rgb - Uint8Array of length 64*64*3 (row-major, no alpha)
 * @returns L2-normalized 768-dim feature vector
 */
export function extractFeaturesV2FromPixels(rgb: Uint8Array): number[] {
  const W = GRID_V2
  const H = GRID_V2

  if (rgb.length !== W * H * 3) {
    throw new Error(`Expected ${W * H * 3} bytes, got ${rgb.length}`)
  }

  const gw = gaussianWeights()

  // Precompute grayscale
  const gray = new Float64Array(W * H)
  for (let i = 0; i < W * H; i++) {
    gray[i] = 0.299 * rgb[i * 3] + 0.587 * rgb[i * 3 + 1] + 0.114 * rgb[i * 3 + 2]
  }

  // Precompute Sobel gradients (manual 3×3 convolution avoids Sharp clamping)
  const gxArr = new Float64Array(W * H)
  const gyArr = new Float64Array(W * H)
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      gxArr[y * W + x] =
        -gray[(y - 1) * W + (x - 1)] + gray[(y - 1) * W + (x + 1)] +
        -2 * gray[y * W + (x - 1)] + 2 * gray[y * W + (x + 1)] +
        -gray[(y + 1) * W + (x - 1)] + gray[(y + 1) * W + (x + 1)]

      gyArr[y * W + x] =
        -gray[(y - 1) * W + (x - 1)] - 2 * gray[(y - 1) * W + x] - gray[(y - 1) * W + (x + 1)] +
        gray[(y + 1) * W + (x - 1)] + 2 * gray[(y + 1) * W + x] + gray[(y + 1) * W + (x + 1)]
    }
  }

  const features: number[] = []
  features.push(...spatialColorGrid(rgb, W, H, gw))
  features.push(...hsvSpatialPyramid(rgb, W, H, gw))
  features.push(...gradientHistograms(gxArr, gyArr, W, H))
  features.push(...edgeSpatialMap(gxArr, gyArr, W, H))
  features.push(...textureLBP(gray, W, H))
  features.push(...globalStats(rgb, gray, gxArr, gyArr, W, H, gw))

  if (features.length !== FEATURE_DIM_V2) {
    throw new Error(`Feature dim mismatch: expected ${FEATURE_DIM_V2}, got ${features.length}`)
  }

  return l2Normalize(features)
}
