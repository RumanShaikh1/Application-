// Builds MarketPane.app/Contents/Resources/app-icon.icns from the same
// brand "spark" mark as launcher/assets/build-icon.mjs (Windows .ico) and
// extension/scripts/generate-icons.mjs (toolbar PNGs) - same rasterizer and
// PNG encoder, ported here rather than shared across workspaces (no shared
// build tooling between them yet, same tradeoff already noted in
// web/tailwind.config.js for the Spark identity system).
//
// .icns is a simple TLV container: 'icns' magic, a 4-byte big-endian total
// file length, then one block per icon: a 4-byte OSType code, a 4-byte
// big-endian block length (header included), then raw PNG bytes. This is
// the modern (PNG-based) icns encoding Apple's own `iconutil` produces from
// a .iconset folder - see the ICON_SPECS table below for the standard
// filename/OSType/size mapping.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, '../MarketPane.app/Contents/Resources/app-icon.icns')
mkdirSync(dirname(OUT_PATH), { recursive: true })

const INK = [0x16, 0x15, 0x0f]
const VERMILION = [0xf0, 0x43, 0x2b]

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw)

  return Buffer.concat([signature, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))])
}

// Signed area test for point-in-polygon (even-odd rule) - identical to the
// Windows/extension rasterizers.
function pointInPolygon(px, py, points) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]
    const [xj, yj] = points[j]
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

function sparkPolygon(cx, cy, outerR, waistR) {
  const angles = [-90, 0, 90, 180]
  const points = []
  for (const deg of angles) {
    const rad = (deg * Math.PI) / 180
    points.push([cx + Math.cos(rad) * outerR, cy + Math.sin(rad) * outerR])
    const nextRad = ((deg + 45) * Math.PI) / 180
    points.push([cx + Math.cos(nextRad) * waistR, cy + Math.sin(nextRad) * waistR])
  }
  return points
}

// macOS icons get real corner-rounding + padding from the system (Big Sur+
// squircle masking), so - unlike the toolbar/.ico rasterizers, which fill
// edge-to-edge - this leaves ~9% margin and paints a solid ink rounded
// square behind the mark, matching how a real macOS app icon is composed
// (a padded "canvas" square, not a full-bleed glyph) rather than relying on
// the OS mask alone to save it from looking like a flat cutout.
function renderIconPng(size) {
  const rgba = Buffer.alloc(size * size * 4)
  const margin = size * 0.09
  const canvasR = size * 0.22
  const cx = size / 2
  const cy = size / 2
  const outerR = (size - margin * 2) * 0.36
  const waistR = (size - margin * 2) * 0.11
  const polygon = sparkPolygon(cx, cy, outerR, waistR)

  function insideRoundedCanvas(x, y) {
    const left = margin
    const top = margin
    const right = size - margin
    const bottom = size - margin
    const cxNear = Math.min(Math.max(x, left + canvasR), right - canvasR)
    const cyNear = Math.min(Math.max(y, top + canvasR), bottom - canvasR)
    if (x >= left && x <= right && y >= top && y <= bottom) {
      if ((x < left + canvasR || x > right - canvasR) && (y < top + canvasR || y > bottom - canvasR)) {
        const dx = x - cxNear
        const dy = y - cyNear
        return dx * dx + dy * dy <= canvasR * canvasR
      }
      return true
    }
    return false
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5
      const py = y + 0.5
      const offset = (y * size + x) * 4
      if (!insideRoundedCanvas(px, py)) {
        rgba[offset] = 0
        rgba[offset + 1] = 0
        rgba[offset + 2] = 0
        rgba[offset + 3] = 0
        continue
      }
      const inside = pointInPolygon(px, py, polygon)
      const [r, g, b] = inside ? VERMILION : INK
      rgba[offset] = r
      rgba[offset + 1] = g
      rgba[offset + 2] = b
      rgba[offset + 3] = 255
    }
  }
  return encodePng(size, size, rgba)
}

// Standard iconutil .iconset -> .icns mapping (unchanged for well over a
// decade of macOS releases).
const ICON_SPECS = [
  { osType: 'icp4', size: 16 },
  { osType: 'ic11', size: 32 }, // 16x16@2x
  { osType: 'icp5', size: 32 },
  { osType: 'ic12', size: 64 }, // 32x32@2x
  { osType: 'ic07', size: 128 },
  { osType: 'ic13', size: 256 }, // 128x128@2x
  { osType: 'ic08', size: 256 },
  { osType: 'ic14', size: 512 }, // 256x256@2x
  { osType: 'ic09', size: 512 },
  { osType: 'ic10', size: 1024 } // 512x512@2x
]

const pngCache = new Map()
function pngFor(size) {
  if (!pngCache.has(size)) pngCache.set(size, renderIconPng(size))
  return pngCache.get(size)
}

const blocks = ICON_SPECS.map(({ osType, size }) => {
  const png = pngFor(size)
  const header = Buffer.alloc(8)
  header.write(osType, 0, 'ascii')
  header.writeUInt32BE(8 + png.length, 4)
  return Buffer.concat([header, png])
})

const body = Buffer.concat(blocks)
const totalLength = 8 + body.length
const fileHeader = Buffer.alloc(8)
fileHeader.write('icns', 0, 'ascii')
fileHeader.writeUInt32BE(totalLength, 4)

const icns = Buffer.concat([fileHeader, body])
writeFileSync(OUT_PATH, icns)
console.log(`wrote ${OUT_PATH} (${icns.length} bytes, ${ICON_SPECS.length} sizes: ${ICON_SPECS.map((s) => s.size).join(', ')})`)
