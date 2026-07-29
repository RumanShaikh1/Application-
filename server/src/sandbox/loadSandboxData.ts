import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PriceWindow, SandboxFundamentalsSnapshot, StockAnalysis } from '../../../shared/types.js'

const currentDir = dirname(fileURLToPath(import.meta.url))
const SANDBOX_DIR = join(currentDir, '../../data/sandbox')
const ANALYSIS_DIR = join(SANDBOX_DIR, 'analysis')

// Loaded once at startup, from local fixtures only - no live call, ever
// (see CLAUDE.md's Sandbox invariants). Fundamentals and prices are each a
// single file (one snapshot, one window); analysis is one file per symbol,
// same "add a file, no code change" pattern as scenarios/loadScenarios.ts -
// deliberately NOT every symbol needs one yet (see findStockAnalysis).

const fundamentalsSnapshot: SandboxFundamentalsSnapshot = JSON.parse(readFileSync(join(SANDBOX_DIR, 'fundamentals.json'), 'utf-8'))
if (!fundamentalsSnapshot.asOfDate || !fundamentalsSnapshot.companies?.length) {
  throw new Error('server/data/sandbox/fundamentals.json is missing required fields.')
}

const priceWindow: PriceWindow = JSON.parse(readFileSync(join(SANDBOX_DIR, 'prices.json'), 'utf-8'))
if (!priceWindow.id || !priceWindow.seriesBySymbol) {
  throw new Error('server/data/sandbox/prices.json is missing required fields.')
}

function readAnalysisFile(fileName: string): StockAnalysis {
  const raw = readFileSync(join(ANALYSIS_DIR, fileName), 'utf-8')
  const analysis = JSON.parse(raw) as StockAnalysis
  if (!analysis.symbol || !analysis.strengths?.length || !analysis.weaknesses?.length || !analysis.checkpoints?.length) {
    throw new Error(`Sandbox analysis fixture "${fileName}" is missing required fields.`)
  }
  return analysis
}

const analysisBySymbol = new Map<string, StockAnalysis>(
  readdirSync(ANALYSIS_DIR)
    .filter((fileName) => fileName.endsWith('.json'))
    .map(readAnalysisFile)
    .map((analysis) => [analysis.symbol.toUpperCase(), analysis])
)

export function getSandboxFundamentals(): SandboxFundamentalsSnapshot {
  return fundamentalsSnapshot
}

export function getSandboxPriceWindow(): PriceWindow {
  return priceWindow
}

export function findSandboxCompany(symbol: string) {
  return fundamentalsSnapshot.companies.find((company) => company.symbol.toUpperCase() === symbol.toUpperCase())
}

/** Undefined for a symbol that hasn't been authored yet - not every one of the 20 has in-depth analysis yet, and that's shown honestly rather than faked. */
export function findStockAnalysis(symbol: string): StockAnalysis | undefined {
  return analysisBySymbol.get(symbol.toUpperCase())
}

/** Undefined if the symbol is unknown or the day is out of the window's range - never extrapolated (see SandboxMarketProvider.getClose). */
export function getSandboxClose(symbol: string, day: number): number | undefined {
  return priceWindow.seriesBySymbol[symbol.toUpperCase()]?.find((point) => point.day === day)?.close
}

export function getSandboxWindowLastDay(): number {
  const anySeries = Object.values(priceWindow.seriesBySymbol)[0] ?? []
  return anySeries.length > 0 ? anySeries[anySeries.length - 1].day : 0
}
