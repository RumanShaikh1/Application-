import { dataManifest } from './generatedDataManifest'
import { setDataFileSystem, type DataFileSystem } from '../../../server/src/dataFs'

// Side-effect only, self-installing on import (mirrors server/src/nodeDataFs.ts's
// pattern exactly) - must be imported before server/src/mobileDispatch.ts
// anywhere in this app (see dispatchBridge.ts's import order) since ES
// module imports are hoisted and evaluated in declaration order: if
// mobileDispatch.ts's import came first, its loaders' top-level
// readDataFileText/listDataFiles calls would run before this file's
// setDataFileSystem call ever executes, regardless of where either import
// is textually written relative to any function call.
//
// Android has no filesystem to dynamically list at runtime (see
// server/src/dataFs.ts) - dataManifest is generated at build time by
// server/scripts/generate-mobile-data-manifest.mjs from the same
// server/data/**/*.json fixtures the desktop/Mac builds read directly,
// each already parsed by Metro's own JSON-module support. readFileText
// re-stringifies once (the loaders immediately JSON.parse it back) purely
// to keep the same string-returning DataFileSystem contract both platforms
// share - negligible cost, paid once per file at app startup.
class AndroidDataFileSystem implements DataFileSystem {
  readFileText(relativePath: string): string {
    const value = dataManifest[relativePath]
    if (value === undefined) {
      throw new Error(
        `Data file "${relativePath}" is not in the generated manifest - if this is a newly added fixture, re-run server/scripts/generate-mobile-data-manifest.mjs.`
      )
    }
    return JSON.stringify(value)
  }

  listFiles(relativeDir: string): string[] {
    const prefix = `${relativeDir}/`
    return Object.keys(dataManifest)
      .filter((key) => key.startsWith(prefix) && !key.slice(prefix.length).includes('/'))
      .map((key) => key.slice(prefix.length))
  }
}

setDataFileSystem(new AndroidDataFileSystem())
