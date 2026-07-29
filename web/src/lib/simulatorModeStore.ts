export type SimulatorMode = 'live' | 'replay'

const STORAGE_KEY = 'marketpane.simulator.mode'

export function getStoredSimulatorMode(): SimulatorMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'replay' ? 'replay' : 'live'
  } catch {
    return 'live'
  }
}

export function storeSimulatorMode(mode: SimulatorMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Storage can be unavailable (private browsing, quota) - the toggle
    // still works for the session, it just won't persist across reloads.
  }
}
