import type { Portfolio, TradeRecord } from '@shared/types'

// Client-side "user model" for the simulator, same reasoning and same
// defensive try/catch pattern as web/src/lib/progressStore.ts (no
// accounts/db yet). The portfolio itself travels to the server on every
// trade request and the updated version comes back in the response - this
// module's only job is persisting whatever the server last returned.
const STORAGE_KEY = 'marketpane.simulator.portfolio'
const STARTING_CASH = 100_000

export interface SimulatorState {
  portfolio: Portfolio
  trades: TradeRecord[]
}

function defaultState(): SimulatorState {
  return { portfolio: { cashBalance: STARTING_CASH, holdings: [] }, trades: [] }
}

export function getState(): SimulatorState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return defaultState()
    const state = parsed as Partial<SimulatorState>
    if (!state.portfolio || !Array.isArray(state.trades)) return defaultState()
    return { portfolio: state.portfolio, trades: state.trades }
  } catch {
    return defaultState()
  }
}

function saveState(state: SimulatorState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage can be unavailable (private browsing, quota) - the simulator
    // degrades gracefully instead of breaking the app.
  }
}

export function recordTrade(updatedPortfolio: Portfolio, trade: TradeRecord): SimulatorState {
  const current = getState()
  const next: SimulatorState = { portfolio: updatedPortfolio, trades: [...current.trades, trade] }
  saveState(next)
  return next
}

export function resetPortfolio(): SimulatorState {
  const next = defaultState()
  saveState(next)
  return next
}

export const SIMULATOR_STARTING_CASH = STARTING_CASH
