// Produces a single, dependency-free server.mjs that the desktop/mobile
// shells can run with nothing but a bare node binary next to it - no
// node_modules, no npm install, no network access needed to set it up.
//
// Explicit ESM output with a literal .mjs extension (not CJS, and not a
// bare .js): esbuild's CJS output leaves `import.meta.url` completely empty
// (a build-time warning, not just a wrong value) - src/dataDir.ts and
// src/index.ts both call fileURLToPath(import.meta.url) unconditionally at
// module load, so that would throw immediately on startup. ESM keeps it a
// valid file:// URL. It won't point at each original source file anymore
// (bundling concatenates every module into the one file Node actually
// loads, so import.meta.url resolves to *that* file's path everywhere) -
// that's fine here only because both call sites treat it purely as a
// fallback behind an explicit env var (SERVER_DATA_DIR, WEB_DIST_PATH) that
// the packaged runtime always sets; the fallback itself just needs to not
// crash, not be meaningful. The literal .mjs extension (rather than relying
// on a sibling package.json's "type") is what makes ESM-vs-CommonJS
// unambiguous once this file is copied out to an arbitrary extraction
// folder with nothing else alongside it.
import { build } from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverDir = path.join(here, '..')

await build({
  entryPoints: [path.join(serverDir, 'src', 'index.ts')],
  outfile: path.join(serverDir, 'dist-embed', 'server.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  sourcemap: false,
  logLevel: 'info',
  // dotenv (a CJS package) calls require('fs') internally. esbuild's ESM
  // output has no way to statically convert that, so it falls back to a
  // shim that checks `typeof require !== 'undefined'` and throws otherwise -
  // true in a CJS module, but there is no global `require` in real ESM.
  // Defining one via node:module's createRequire (the documented fix for
  // exactly this esbuild + ESM + CJS-dependency combination) makes that
  // check succeed and the require call resolve the real builtin.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);"
  }
})

console.log('Wrote server/dist-embed/server.mjs')
