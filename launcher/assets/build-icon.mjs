// Rasterizes the brand spark mark directly into classic uncompressed-DIB
// ICO frames (not PNG-in-ICO) at 16/32/48px. PNG-compressed ICO frames at
// small sizes aren't reliably decoded by .NET's System.Drawing.Icon (used
// by the WinForms launcher window), even though modern Explorer tolerates
// them - so this avoids that fragility entirely.
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const INK = [0x16, 0x15, 0x0f]
const VERMILION = [0xf0, 0x43, 0x2b]

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

/** Returns a top-down RGBA buffer (row 0 = top), same rasterizer as the extension's toolbar icons. */
function rasterize(size) {
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
  return rgba
}

function buildDibFrame(size) {
  const rgba = rasterize(size)

  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0) // biSize
  header.writeInt32LE(size, 4) // biWidth
  header.writeInt32LE(size * 2, 8) // biHeight (doubled: XOR + AND mask)
  header.writeUInt16LE(1, 12) // biPlanes
  header.writeUInt16LE(32, 14) // biBitCount
  header.writeUInt32LE(0, 16) // biCompression: BI_RGB
  header.writeUInt32LE(size * size * 4, 20) // biSizeImage
  header.writeInt32LE(0, 24)
  header.writeInt32LE(0, 28)
  header.writeUInt32LE(0, 32)
  header.writeUInt32LE(0, 36)

  // XOR (color) data: BGRA, bottom-up row order.
  const xor = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    const srcRow = y
    const dstRow = size - 1 - y
    for (let x = 0; x < size; x++) {
      const srcOff = (srcRow * size + x) * 4
      const dstOff = (dstRow * size + x) * 4
      xor[dstOff] = rgba[srcOff + 2] // B
      xor[dstOff + 1] = rgba[srcOff + 1] // G
      xor[dstOff + 2] = rgba[srcOff] // R
      xor[dstOff + 3] = rgba[srcOff + 3] // A
    }
  }

  // AND (opacity) mask: 1bpp, all zero = "fully controlled by alpha channel".
  const andRowBytes = Math.ceil(size / 32) * 4
  const and = Buffer.alloc(andRowBytes * size, 0)

  return Buffer.concat([header, xor, and])
}

const sizes = [48, 32, 16]
const frames = sizes.map(buildDibFrame)

const dirHeader = Buffer.alloc(6)
dirHeader.writeUInt16LE(0, 0)
dirHeader.writeUInt16LE(1, 2)
dirHeader.writeUInt16LE(frames.length, 4)

let offset = 6 + frames.length * 16
const entries = []
for (let i = 0; i < frames.length; i++) {
  const size = sizes[i]
  const entry = Buffer.alloc(16)
  entry.writeUInt8(size >= 256 ? 0 : size, 0)
  entry.writeUInt8(size >= 256 ? 0 : size, 1)
  entry.writeUInt8(0, 2)
  entry.writeUInt8(0, 3)
  entry.writeUInt16LE(1, 4)
  entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(frames[i].length, 8)
  entry.writeUInt32LE(offset, 12)
  offset += frames[i].length
  entries.push(entry)
}

const ico = Buffer.concat([dirHeader, ...entries, ...frames])
writeFileSync(join(__dirname, 'app-icon.ico'), ico)
console.log(`wrote app-icon.ico (${ico.length} bytes, sizes: ${sizes.join(', ')})`)
