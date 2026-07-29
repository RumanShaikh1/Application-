import type { ScenarioAnswerRequest, ScenarioAnswerResponse, ScenarioStagePayload, ScenarioSummary } from '../../../shared/types'

// Expo inlines any EXPO_PUBLIC_-prefixed env var at build time (the RN/Expo
// equivalent of Vite's VITE_ prefix used in web/src/lib/api.ts). An Android
// emulator maps host loopback to 10.0.2.2, not localhost, and a physical
// device needs the dev machine's real LAN IP - neither can be known
// automatically, so both require setting this explicitly. See the mobile/
// README section for the exact value per target.
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8787'

interface ApiErrorBody {
  error?: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null
    throw new Error(body?.error ?? `Request failed (${response.status}).`)
  }

  return (await response.json()) as T
}

export const api = {
  listScenarios: (): Promise<ScenarioSummary[]> => request('/api/scenarios'),

  getScenarioStage: (scenarioId: string, stageIndex: number): Promise<ScenarioStagePayload> =>
    request(`/api/scenarios/${encodeURIComponent(scenarioId)}/stage/${stageIndex}`),

  submitAnswer: (scenarioId: string, body: ScenarioAnswerRequest): Promise<ScenarioAnswerResponse> =>
    request(`/api/scenarios/${encodeURIComponent(scenarioId)}/answer`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
}
