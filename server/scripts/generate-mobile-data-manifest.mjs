// Android has no filesystem to dynamically list at runtime the way
// readdirSync does on desktop/Mac (see server/src/dataFs.ts's file comment
// for the full reasoning) - this script walks server/data/** once, at build
// time, and emits a TS file that `import`s every JSON fixture directly
// (letting Metro parse them with its own native JSON-module support, rather
// than re-embedding the raw text as escaped string literals) plus a flat
// manifest object keyed by the same relative-path strings the loaders
// already use (e.g. 'sandbox/fundamentals.json', 'scenarios/chasing-runup-01.json').
// Run this again whenever a data fixture is added, removed, or renamed -
// see mobile/README.md.
import { readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(here, '..', 'data')
const outPath = path.join(here, '..', '..', 'mobile', 'src', 'bridge', 'generatedDataManifest.ts')

function walkJsonFiles(dir, relativePrefix) {
  const entries = []
  for (const name of readdirSync(dir).sort()) {
    const fullPath = path.join(dir, name)
    const relativePath = relativePrefix ? `${relativePrefix}/${name}` : name
    if (statSync(fullPath).isDirectory()) {
      entries.push(...walkJsonFiles(fullPath, relativePath))
    } else if (name.endsWith('.json')) {
      entries.push(relativePath)
    }
  }
  return entries
}

const relativePaths = walkJsonFiles(dataDir, '')

function toImportIdentifier(relativePath, index) {
  return `data_${index}`
}

const importLines = relativePaths.map((relativePath, index) => {
  const identifier = toImportIdentifier(relativePath, index)
  // web/dist's own build never touches server/data, and this generated file
  // lives at mobile/src/bridge/ - three levels up gets back to the repo
  // root, then into server/data/<relativePath>.
  return `import ${identifier} from '../../../server/data/${relativePath}'`
})

const manifestEntries = relativePaths.map((relativePath, index) => `  ${JSON.stringify(relativePath)}: ${toImportIdentifier(relativePath, index)}`)

const output = `// GENERATED FILE - do not hand-edit.
// Produced by server/scripts/generate-mobile-data-manifest.mjs from every
// *.json file under server/data/. Re-run that script (not this file) after
// adding, removing, or renaming a data fixture, then commit the result.
${importLines.join('\n')}

export const dataManifest: Record<string, unknown> = {
${manifestEntries.join(',\n')}
}
`

writeFileSync(outPath, output, 'utf-8')
console.log(`Wrote ${outPath} (${relativePaths.length} data files)`)
