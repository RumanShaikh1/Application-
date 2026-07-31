import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Every loader under src/{sandbox,scenarios,tax,placement,caseStudies} used
// to compute its own "../../data/X" path from its own import.meta.url. That
// works when each file runs as its own module (tsx, vitest), but
// scripts/bundle-for-embed.mjs concatenates every module into one output
// file for the packaged desktop/mobile shells - after that, import.meta.url
// is the same value (the bundle's own path) everywhere, and every loader's
// relative "../../data" would suddenly point somewhere else entirely. This
// is the one place that path is resolved, with an explicit override the
// packaged runtime sets (it copies data/ next to the bundle and points
// SERVER_DATA_DIR at it) - the fallback below is only ever exercised when
// running straight from source, where this file's own currentDir really is
// server/src.
const currentDir = dirname(fileURLToPath(import.meta.url))
export const DATA_ROOT = process.env.SERVER_DATA_DIR || join(currentDir, '..', 'data')
