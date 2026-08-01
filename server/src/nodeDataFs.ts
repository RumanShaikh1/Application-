// Installs the real node:fs-backed DataFileSystem (see dataFs.ts) - only
// ever imported by index.ts (the desktop/Mac/web entry point), as a
// side-effect import placed before every other import so it's installed
// before any loader's module-level code runs. Never imported by
// mobileDispatch.ts or anything it pulls in - Metro would fail to bundle
// the node:fs import below if it were.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DATA_ROOT } from './dataDir.js'
import { setDataFileSystem, type DataFileSystem } from './dataFs.js'

class NodeDataFileSystem implements DataFileSystem {
  readFileText(relativePath: string): string {
    return readFileSync(join(DATA_ROOT, relativePath), 'utf-8')
  }

  listFiles(relativeDir: string): string[] {
    return readdirSync(join(DATA_ROOT, relativeDir))
  }
}

setDataFileSystem(new NodeDataFileSystem())
