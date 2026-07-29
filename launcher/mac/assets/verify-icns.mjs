// One-off: parses the generated .icns back apart to confirm the TLV
// structure is internally consistent (chunk lengths sum to the file size,
// each block's declared PNG data actually starts with the PNG magic), and
// dumps the largest icon to a standalone .png so it can be visually
// inspected with an image viewer - the icns container format itself can't
// be "run" to prove it renders without a real Mac, but this at least proves
// the bytes are well-formed and the rasterized image looks right.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const icnsPath = join(__dirname, '../MarketPane.app/Contents/Resources/app-icon.icns')
const buf = readFileSync(icnsPath)

const magic = buf.toString('ascii', 0, 4)
const totalLength = buf.readUInt32BE(4)
console.log(`magic: "${magic}" (expect "icns")`)
console.log(`declared total length: ${totalLength}, actual file length: ${buf.length}`)
if (magic !== 'icns') throw new Error('Bad magic')
if (totalLength !== buf.length) throw new Error('Declared length does not match actual file size')

let offset = 8
let largestPng = null
let largestSize = 0
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

while (offset < buf.length) {
  const osType = buf.toString('ascii', offset, offset + 4)
  const blockLength = buf.readUInt32BE(offset + 4)
  const dataStart = offset + 8
  const dataEnd = offset + blockLength
  const pngData = buf.subarray(dataStart, dataEnd)
  const hasPngMagic = pngData.subarray(0, 8).equals(pngSignature)
  const width = pngData.readUInt32BE(16) // IHDR starts at byte 8 of PNG stream (after signature) + 4(len)+4(type) = offset 16 for width
  console.log(`  ${osType}: block ${blockLength}B, PNG magic ok: ${hasPngMagic}, IHDR width: ${width}`)
  if (!hasPngMagic) throw new Error(`Block ${osType} does not start with a valid PNG signature`)
  if (width > largestSize) {
    largestSize = width
    largestPng = pngData
  }
  offset = dataEnd
}

if (offset !== buf.length) throw new Error(`Blocks did not consume the whole file: ended at ${offset}, file is ${buf.length}`)
console.log('All blocks consumed exactly - structure is internally consistent.')

const outPng = join(__dirname, '../../../temporary screenshots', 'mac-icon-preview-1024.png')
writeFileSync(outPng, largestPng)
console.log(`Wrote largest icon (${largestSize}x${largestSize}) to ${outPng} for visual inspection.`)
