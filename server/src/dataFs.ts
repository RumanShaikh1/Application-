// The data-fixture loaders (sandbox/scenarios/tax/placement/caseStudies)
// need to read JSON files and list a directory's contents - straightforward
// with node:fs on desktop/Mac, but Metro (the Android app's bundler, see
// mobile/src/bridge/dispatchBridge.ts -> server/src/mobileDispatch.ts)
// cannot resolve `node:fs` at all: it statically crawls every import in the
// dependency graph, so a bare `import { readFileSync } from 'node:fs'`
// ANYWHERE reachable from mobileDispatch.ts fails the whole Android build,
// not just at runtime.
//
// This file is the one seam that abstracts "read a data file" - it has no
// node:fs import itself, so it's always safe for Metro to bundle. The
// concrete implementation is installed via setDataFileSystem():
// server/src/nodeDataFs.ts (real node:fs, installed by index.ts, the only
// entry point that ever imports it) for desktop/Mac, and
// mobile/src/bridge/androidDataFs.ts (reads from a manifest of file
// contents generated at build time - see server/scripts/
// generate-mobile-data-manifest.mjs - since Android has no filesystem to
// dynamically list at runtime) for the Android app.
export interface DataFileSystem {
  readFileText(relativePath: string): string
  listFiles(relativeDir: string): string[]
}

let current: DataFileSystem | null = null

export function setDataFileSystem(fs: DataFileSystem): void {
  current = fs
}

function requireFileSystem(): DataFileSystem {
  if (!current) {
    throw new Error(
      'No DataFileSystem installed - import server/src/nodeDataFs.js (desktop/Mac) or call setDataFileSystem with the Android adapter before reading any data file.'
    )
  }
  return current
}

export function readDataFileText(relativePath: string): string {
  return requireFileSystem().readFileText(relativePath)
}

export function listDataFiles(relativeDir: string): string[] {
  return requireFileSystem().listFiles(relativeDir)
}
