import type { OpenLossPosition, RealizedGainsThisFY } from '@shared/types'

// Client-side only, no login - same reasoning and defensive try/catch
// pattern as portfolioStore.ts. Realised gains and open loss positions are
// entered by hand each session; nothing is sent anywhere until the user
// asks for the loss-harvesting check.
const STORAGE_KEY = 'marketpane.tax.fyState'

export interface TaxFYState {
  realizedGains: RealizedGainsThisFY
  positions: OpenLossPosition[]
}

function defaultState(): TaxFYState {
  return { realizedGains: { shortTermGains: 0, longTermGains: 0 }, positions: [] }
}

export function getFYState(): TaxFYState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return defaultState()
    const state = parsed as Partial<TaxFYState>
    if (!state.realizedGains || !Array.isArray(state.positions)) return defaultState()
    return { realizedGains: state.realizedGains, positions: state.positions }
  } catch {
    return defaultState()
  }
}

function saveState(state: TaxFYState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage can be unavailable (private browsing, quota) - degrade gracefully.
  }
}

export function setRealizedGains(realizedGains: RealizedGainsThisFY): TaxFYState {
  const next = { ...getFYState(), realizedGains }
  saveState(next)
  return next
}

export function addLossPosition(position: OpenLossPosition): TaxFYState {
  const current = getFYState()
  const next = { ...current, positions: [...current.positions, position] }
  saveState(next)
  return next
}

export function removeLossPosition(id: string): TaxFYState {
  const current = getFYState()
  const next = { ...current, positions: current.positions.filter((p) => p.id !== id) }
  saveState(next)
  return next
}

export function resetFYState(): TaxFYState {
  const next = defaultState()
  saveState(next)
  return next
}
