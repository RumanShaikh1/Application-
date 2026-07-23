import { resolve } from 'path'
import { defineConfig } from 'vite'

// The MV3 service worker: also bundled as a self-contained IIFE (simplest
// and most compatible option - no import-map/module worker quirks).
export default defineConfig({
  publicDir: 'public',
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../shared')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false, // vite.config.content.ts already cleared dist/ this run
    lib: {
      entry: resolve(__dirname, 'src/background.ts'),
      name: 'MarketPaneBackground',
      formats: ['iife'],
      fileName: () => 'background.js'
    }
  }
})
