import { BASICS_PARTS } from './basicsContent'

// Client-side progress for the beginner curriculum - same no-accounts,
// localStorage-only pattern as progressStore.ts/taxStore.ts. `promptShown`
// is what makes the first-run redirect (see routes/HomeRoute.tsx) fire
// exactly once per browser: it's set the moment /learn is ever reached,
// whether the user finishes it or skips, so this app never nags a user who
// has already made a choice.
const STORAGE_KEY = 'marketpane.basics.progress'

export interface BasicsState {
  completedPartIds: string[]
  skipped: boolean
  promptShown: boolean
}

const DEFAULT_STATE: BasicsState = { completedPartIds: [], skipped: false, promptShown: false }

export function getBasicsState(): BasicsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return DEFAULT_STATE
    const candidate = parsed as Partial<BasicsState>
    return {
      completedPartIds: Array.isArray(candidate.completedPartIds) ? candidate.completedPartIds : [],
      skipped: candidate.skipped === true,
      promptShown: candidate.promptShown === true
    }
  } catch {
    return DEFAULT_STATE
  }
}

function writeState(state: BasicsState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage can be unavailable (private browsing, quota) - basics
    // tracking degrades gracefully instead of breaking the app.
  }
}

export function markPromptShown(): void {
  const state = getBasicsState()
  if (state.promptShown) return
  writeState({ ...state, promptShown: true })
}

export function markSkipped(): void {
  writeState({ ...getBasicsState(), skipped: true, promptShown: true })
}

export function markPartComplete(partId: string): void {
  const state = getBasicsState()
  if (state.completedPartIds.includes(partId)) return
  writeState({ ...state, completedPartIds: [...state.completedPartIds, partId] })
}

export function isBasicsComplete(state: BasicsState): boolean {
  return BASICS_PARTS.every((part) => state.completedPartIds.includes(part.id))
}
