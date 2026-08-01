// Vitest imports loader modules directly (never through index.ts, the only
// place that otherwise installs this) - see dataFs.ts/nodeDataFs.ts for why
// the data loaders need a DataFileSystem installed before their top-level
// code runs. Always safe here since vitest only ever runs under real Node,
// never bundled by Metro.
import './src/nodeDataFs.ts'
