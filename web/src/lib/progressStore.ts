import type { ScenarioAttemptRecord } from '@shared/types'

// Client-side "user model" for Decision Replay - see the implementation
// plan's note on why this is localStorage rather than a server endpoint
// (no accounts/db in scope yet). The record shape is a shared type, so a
// server-side store can replace this file later without changing callers.
const STORAGE_KEY = 'marketpane.decisionReplay.attempts'

function readAll(): ScenarioAttemptRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ScenarioAttemptRecord[]) : []
  } catch {
    return []
  }
}

function writeAll(records: ScenarioAttemptRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // Storage can be unavailable (private browsing, quota) - progress
    // tracking degrades gracefully instead of breaking the app.
  }
}

export function recordAttempt(record: ScenarioAttemptRecord): void {
  const records = readAll()
  records.push(record)
  writeAll(records)
}

export function getAllAttempts(): ScenarioAttemptRecord[] {
  return readAll().sort((a, b) => b.answeredAt - a.answeredAt)
}

export function getLatestAttempt(scenarioId: string): ScenarioAttemptRecord | null {
  const records = readAll().filter((record) => record.scenarioId === scenarioId)
  if (records.length === 0) return null
  return records.reduce((latest, record) => (record.answeredAt > latest.answeredAt ? record : latest))
}
