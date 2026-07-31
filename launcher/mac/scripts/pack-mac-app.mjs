// Assembles a distributable MarketPane-mac.zip: the MarketPane.app bundle
// skeleton (Info.plist, launcher script, icon) plus both portable node
// binaries, the bundled server, the built web app, and its data fixtures -
// see MainForm.cs/pack-embedded-runtime.mjs for the Windows equivalent of
// this same "no prerequisites at all" approach.
//
// Built with the `archiver` package rather than a plain zip tool (none of
// which reliably run identically across platforms without extra installs)
// specifically because it can set each entry's real Unix file mode
// (`{ mode: 0o755 }`) in the zip's central directory - critical here since
// this script runs on Windows (this repo's authoring machine has no Mac),
// and the launcher script plus both node binaries must be executable the
// moment a real Mac user unzips the download, with no manual `chmod`
// required. A zip built by a tool that doesn't understand Unix permissions
// (e.g. PowerShell's Compress-Archive) would silently produce a zip that
// extracts everything non-executable on macOS.
//
// Expects server/dist-embed/server.mjs (npm run bundle:embed in server/)
// and web/dist (npm run build in web/) to already exist, plus both portable
// node binaries downloaded from nodejs.org (darwin-arm64 and darwin-x64) -
// see this script's env var checks below for exactly what's needed.
import { existsSync } from 'node:fs'
import { mkdir, rm, cp, copyFile, chmod } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import archiver from 'archiver'
import { createWriteStream } from 'node:fs'

const here = path.dirname(fileURLToPath(import.meta.url))
const macDir = path.join(here, '..')
const repoRoot = path.join(macDir, '..', '..')

const nodeArm64Path = process.env.MARKETPANE_NODE_DARWIN_ARM64
const nodeX64Path = process.env.MARKETPANE_NODE_DARWIN_X64
if (!nodeArm64Path || !existsSync(nodeArm64Path) || !nodeX64Path || !existsSync(nodeX64Path)) {
  console.error(
    'Set MARKETPANE_NODE_DARWIN_ARM64 and MARKETPANE_NODE_DARWIN_X64 to the paths of the portable node binaries ' +
      '(extract the "bin/node" file from https://nodejs.org/dist/vX.Y.Z/node-vX.Y.Z-darwin-arm64.tar.gz and ' +
      'the darwin-x64 equivalent) before running this script.'
  )
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

const stageDir = path.join(macDir, 'dist-stage', 'MarketPane.app')
await rm(path.join(macDir, 'dist-stage'), { recursive: true, force: true })
await mkdir(stageDir, { recursive: true })

const sourceApp = path.join(macDir, 'MarketPane.app')
await cp(path.join(sourceApp, 'Contents', 'Info.plist'), path.join(stageDir, 'Contents', 'Info.plist'))
await mkdir(path.join(stageDir, 'Contents', 'MacOS'), { recursive: true })
await copyFile(
  path.join(sourceApp, 'Contents', 'MacOS', 'MarketPane'),
  path.join(stageDir, 'Contents', 'MacOS', 'MarketPane')
)
await mkdir(path.join(stageDir, 'Contents', 'Resources'), { recursive: true })
await copyFile(
  path.join(sourceApp, 'Contents', 'Resources', 'app-icon.icns'),
  path.join(stageDir, 'Contents', 'Resources', 'app-icon.icns')
)

const resourcesDir = path.join(stageDir, 'Contents', 'Resources')
await copyFile(nodeArm64Path, path.join(resourcesDir, 'node-darwin-arm64'))
await copyFile(nodeX64Path, path.join(resourcesDir, 'node-darwin-x64'))
await copyFile(serverBundle, path.join(resourcesDir, 'server.mjs'))
await copyFile(serverEnvExample, path.join(resourcesDir, '.env.example'))
await cp(serverData, path.join(resourcesDir, 'data'), { recursive: true })
await cp(webDist, path.join(resourcesDir, 'web-dist'), { recursive: true })

// Belt-and-suspenders: also chmod on disk (harmless on Windows, matches
// how a Mac checkout would already have these bits set via .gitattributes/
// git's executable-bit tracking) before archiver reads each file's mode.
for (const p of [
  path.join(stageDir, 'Contents', 'MacOS', 'MarketPane'),
  path.join(resourcesDir, 'node-darwin-arm64'),
  path.join(resourcesDir, 'node-darwin-x64')
]) {
  await chmod(p, 0o755).catch(() => {})
}

const zipPath = path.join(macDir, 'dist-stage', 'MarketPane-mac.zip')
await rm(zipPath, { force: true })

await new Promise((resolve, reject) => {
  const output = createWriteStream(zipPath)
  const archive = archiver('zip', { zlib: { level: 9 } })
  output.on('close', resolve)
  archive.on('error', reject)
  archive.pipe(output)

  const executableNames = new Set(['MarketPane', 'node-darwin-arm64', 'node-darwin-x64'])
  archive.directory(stageDir, 'MarketPane.app', (entry) => {
    const baseName = path.basename(entry.name)
    entry.mode = executableNames.has(baseName) ? 0o755 : 0o644
    return entry
  })

  archive.finalize()
})

console.log(`Wrote ${zipPath}`)
