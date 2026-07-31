// Assembles everything MarketPane.Desktop needs to run with zero
// prerequisites - a portable node.exe, the bundled server, the built web
// app, and its data fixtures - into one zip, embedded into the published
// .exe as a single resource (see MainForm.cs's EnsureEmbeddedRuntimeAsync).
// One zip instead of many individual EmbeddedResource entries because
// nested folders full of small files (fonts, per-symbol JSON fixtures) turn
// into fragile, hard-to-predict dotted manifest-resource names; a single
// zip resource has one name to look up and extracts with the framework's
// own ZipFile API.
//
// Expects server/dist-embed/server.mjs (npm run bundle:embed in server/)
// and web/dist (npm run build in web/) to already exist - this script does
// not rebuild them, so a full packaging run is:
//   (cd server && npm run bundle:embed) && (cd web && npm run build) && node launcher/MarketPane.Desktop/scripts/pack-embedded-runtime.mjs
import { existsSync, mkdirSync, rmSync, cpSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const here = path.dirname(fileURLToPath(import.meta.url))
const desktopDir = path.join(here, '..')
const repoRoot = path.join(desktopDir, '..', '..')

const nodeExePath = process.env.MARKETPANE_PORTABLE_NODE_EXE
if (!nodeExePath || !existsSync(nodeExePath)) {
  console.error('Set MARKETPANE_PORTABLE_NODE_EXE to the path of a portable win-x64 node.exe (see README-embed.md for where that comes from) before running this script.')
  process.exit(1)
}

const serverBundle = path.join(repoRoot, 'server', 'dist-embed', 'server.mjs')
const serverData = path.join(repoRoot, 'server', 'data')
const serverEnvExample = path.join(repoRoot, 'server', '.env.example')
const webDist = path.join(repoRoot, 'web', 'dist')

for (const [label, p] of [['server bundle', serverBundle], ['server data', serverData], ['web build', webDist]]) {
  if (!existsSync(p)) {
    console.error(`Missing ${label} at ${p} - run its build step first (see this script's header comment).`)
    process.exit(1)
  }
}

const stageDir = path.join(desktopDir, 'embed', 'stage')
rmSync(stageDir, { recursive: true, force: true })
mkdirSync(stageDir, { recursive: true })

copyFileSync(nodeExePath, path.join(stageDir, 'node.exe'))
copyFileSync(serverBundle, path.join(stageDir, 'server.mjs'))
copyFileSync(serverEnvExample, path.join(stageDir, '.env.example'))
cpSync(serverData, path.join(stageDir, 'data'), { recursive: true })
cpSync(webDist, path.join(stageDir, 'web-dist'), { recursive: true })

const zipPath = path.join(desktopDir, 'embed', 'runtime.zip')
rmSync(zipPath, { force: true })

// Compress-Archive (not an external zip tool) so this runs on any Windows
// box with PowerShell and nothing else installed.
execFileSync('powershell', [
  '-NoProfile',
  '-Command',
  `Compress-Archive -Path "${stageDir}\\*" -DestinationPath "${zipPath}" -CompressionLevel Optimal`
])

rmSync(stageDir, { recursive: true, force: true })

console.log(`Wrote ${zipPath}`)
