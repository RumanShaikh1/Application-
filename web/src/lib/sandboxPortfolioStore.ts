import type { SandboxPortfolioState } from '@shared/types'

// Client-side "user model" for the 2020 replay - same reasoning and
// defensive try/catch pattern as portfolioStore.ts (no accounts/db yet).
// Separate storage key/state shape from the live Simulator's portfolio -
// the two modes never share a portfolio, cash balance, or trade history.
const STORAGE_KEY = 'marketpane.sandbox.portfolio'
const STARTING_CASH = 100_000
export const SANDBOX_FREEFORM_MISSION_ID = 'freeform'

function defaultState(): SandboxPortfolioState {
  return { missionId: SANDBOX_FREEFORM_MISSION_ID, portfolio: { cashBalance: STARTING_CASH, holdings: [] }, positionMeta: [], dayCursor: 0, tradeLog: [] }
}

export function getSandboxState(): SandboxPortfolioState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return defaultState()
    const state = parsed as Partial<SandboxPortfolioState>
    if (!state.portfolio || !Array.isArray(state.positionMeta) || !Array.isArray(state.tradeLog) || typeof state.dayCursor !== 'number') {
      return defaultState()
    }
    return { missionId: state.missionId ?? SANDBOX_FREEFORM_MISSION_ID, portfolio: state.portfolio, positionMeta: state.positionMeta, dayCursor: state.dayCursor, tradeLog: state.tradeLog }
  } catch {
    return defaultState()
  }
}

function saveSandboxState(state: SandboxPortfolioState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage can be unavailable (private browsing, quota) - the replay
    // degrades gracefully (state just won't persist) instead of breaking.
  }
}

export function saveSandboxTradeState(state: SandboxPortfolioState): void {
  saveSandboxState(state)
}

export function advanceSandboxDay(days: number, lastDay: number): SandboxPortfolioState {
  const current = getSandboxState()
  const next = { ...current, dayCursor: Math.min(Math.max(current.dayCursor + days, 0), lastDay) }
  saveSandboxState(next)
  return next
}

export function resetSandboxPortfolio(): SandboxPortfolioState {
  const next = defaultState()
  saveSandboxState(next)
  return next
}

export const SANDBOX_STARTING_CASH = STARTING_CASH
