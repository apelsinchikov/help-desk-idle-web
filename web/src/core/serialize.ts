// GameState ⇄ JSON. Битый, чужой или «из будущего» сейв → null (игра не падает).
import { CURRENT_SCHEMA } from './state.ts'
import type { GameState, JobState } from './state.ts'

export function encodeState(state: GameState): string {
  return JSON.stringify(state)
}

/** Принимает строку JSON или уже распарсенный объект (например, `payload` из Supabase). */
export function decodeState(raw: unknown): GameState | null {
  let value = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!isObject(value)) return null
  const { schemaVersion, money, lifetimeEarnings, jobs, lastActiveAt, settings } = value
  if (!isInt(schemaVersion) || schemaVersion < 1 || schemaVersion > CURRENT_SCHEMA) return null
  if (!isNum(money) || !isNum(lifetimeEarnings) || !isNum(lastActiveAt)) return null
  if (!isObject(settings)) return null
  if (settings.language !== 'ru' && settings.language !== 'en') return null
  if (typeof settings.haptics !== 'boolean') return null
  if (!isObject(jobs)) return null

  const parsedJobs: Record<string, JobState> = {}
  for (const [id, job] of Object.entries(jobs)) {
    if (!isObject(job)) return null
    const { level, hasManager, startedAt } = job
    if (!isInt(level) || level < 0 || typeof hasManager !== 'boolean') return null
    if (startedAt !== null && !isNum(startedAt)) return null
    parsedJobs[id] = { level, hasManager, startedAt: startedAt as number | null }
  }
  return {
    schemaVersion,
    money,
    lifetimeEarnings,
    jobs: parsedJobs,
    lastActiveAt,
    settings: { language: settings.language, haptics: settings.haptics },
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isInt = (v: unknown): v is number => isNum(v) && Number.isInteger(v)
