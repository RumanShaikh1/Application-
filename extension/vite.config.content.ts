import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Content scripts declared in manifest.json's content_scripts array must be
// classic (non-module) scripts, so this bundles the whole content script -
// React, ReactDOM, everything - into one self-contained IIFE with no shared
// chunks. Run before vite.config.background.ts (emptyOutDir clears dist/
// once; the background build that follows must NOT re-clear it).
export default defineConfig({
  plugins: [react()],
  // Library mode doesn't auto-replace process.env.NODE_ENV the way Vite's
  // app build does, and React reads it directly - without this the bundle
  // throws `process is not defined` the moment it runs in the page.
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../shared')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/content/main.tsx'),
      name: 'MarketPaneContent',
      formats: ['iife'],
      fileName: () => 'content.js'
    },
    rollupOptions: {
      output: {
        // Keep CSS output name predictable so manifest.json can reference it
        // (kept out of content_scripts.css on purpose - it's injected
        // manually into the shadow root by main.tsx, not the page head).
        assetFileNames: 'content.[ext]'
      }
    }
  }
})
