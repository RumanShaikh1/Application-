import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Every loader under src/{sandbox,scenarios,tax,placement,caseStudies} used
// to compute its own "../../data/X" path from its own import.meta.url. That
// works when each file runs as its own module (tsx, vitest), but
// scripts/bundle-for-embed.mjs concatenates every module into one output
// file for the packaged desktop/mobile shells - after that, import.meta.url
// is the same value (the bundle's own path) everywhere, and every loader's
// relative "../../data" would suddenly point somewhere else entirely. This
// is the one place that path is resolved, with an explicit override every
// packaged runtime sets (each copies data/ somewhere and points
// SERVER_DATA_DIR at it) - the fallback below is only ever exercised when
// running straight from source, where this file's own currentDir really is
// server/src.
//
// The fallback is wrapped in a function (not computed eagerly above the ||)
// so it is never even called, let alone evaluated, when SERVER_DATA_DIR is
// set - which matters beyond tidiness for the Android build: this file is
// also bundled by Metro (React Native's bundler, see mobile/src/bridge/
// dispatchBridge.ts -> server/src/mobileDispatch.ts -> here), and Metro's
// support for import.meta is unproven. SERVER_DATA_DIR is always set before
// this ever runs on Android, so that expression is guaranteed to short-
// circuit away before Metro's handling of it would ever matter.
function resolveFallbackDataRoot(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url))
  return join(currentDir, '..', 'data')
}

export const DATA_ROOT = process.env.SERVER_DATA_DIR || resolveFallbackDataRoot()
