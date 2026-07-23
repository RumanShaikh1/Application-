// Hand-rolled PNG encoder (no image-library dependency) that rasterizes the
// brand's four-point "spark" mark - ink background, vermilion mark, upright,
// pinched to centre, per app_design_guideline.png section 01 - at each
// required toolbar icon size.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/icons')
mkdirSync(OUT_DIR, { recursive: true })

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

function chunk(type, data) {
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

  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// Signed area test for point-in-polygon (even-odd rule).
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

// Four-point spark: outer tips on the axes, concave waist pinched toward
// centre - matches "points always 4, on the axes / curves quadratic,
// control at centre" from the guideline (approximated with a slightly
// concave polygon rather than true bezier, which reads fine at icon sizes).
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

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4)
  const cx = size / 2
  const cy = size / 2
  const outerR = size * 0.42
  const waistR = size * 0.13
  const polygon = sparkPolygon(cx, cy, outerR, waistR)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inside = pointInPolygon(x + 0.5, y + 0.5, polygon)
      const [r, g, b] = inside ? VERMILION : INK
      const offset = (y * size + x) * 4
      rgba[offset] = r
      rgba[offset + 1] = g
      rgba[offset + 2] = b
      rgba[offset + 3] = 255
    }
  }
  return encodePng(size, size, rgba)
}

for (const size of [16, 48, 128]) {
  const png = renderIcon(size)
  writeFileSync(join(OUT_DIR, `icon${size}.png`), png)
  console.log(`wrote icon${size}.png (${png.length} bytes)`)
}
