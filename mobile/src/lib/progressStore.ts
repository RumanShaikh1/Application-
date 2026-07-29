import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ScenarioAttemptRecord } from '../../../shared/types'

// Client-side "user model" for Decision Replay, same shape and same
// no-accounts-yet rationale as web/src/lib/progressStore.ts. AsyncStorage
// is RN's equivalent of localStorage, but its API is inherently async
// (there is no synchronous storage primitive on native platforms) - every
// function here is a real shape difference from the web version, not a
// copy-paste.
const STORAGE_KEY = 'marketpane.decisionReplay.attempts'

async function readAll(): Promise<ScenarioAttemptRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ScenarioAttemptRecord[]) : []
  } catch {
    return []
  }
}

async function writeAll(records: ScenarioAttemptRecord[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // Storage can fail (quota, platform quirk) - progress tracking
    // degrades gracefully instead of crashing the app.
  }
}

export async function recordAttempt(record: ScenarioAttemptRecord): Promise<void> {
  const records = await readAll()
  records.push(record)
  await writeAll(records)
}

export async function getAllAttempts(): Promise<ScenarioAttemptRecord[]> {
  const records = await readAll()
  return records.sort((a, b) => b.answeredAt - a.answeredAt)
}

export async function getLatestAttempt(scenarioId: string): Promise<ScenarioAttemptRecord | null> {
  const records = (await readAll()).filter((record) => record.scenarioId === scenarioId)
  if (records.length === 0) return null
  return records.reduce((latest, record) => (record.answeredAt > latest.answeredAt ? record : latest))
}
