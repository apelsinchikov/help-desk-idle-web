// GameState ⇄ JSON. Битый, чужой или «из будущего» сейв → null (игра не падает).
// Схема 1 (этап 1) мигрирует в 2: ранг по уже достигнутым порогам, пустые улучшения, состояние обучения.
import type { GameContent } from './content.ts'
import { CURRENT_SCHEMA, newUiState } from './state.ts'
import type { GameState, JobState, UiState } from './state.ts'

export function encodeState(state: GameState): string {
  return JSON.stringify(state)
}

/**
 * Принимает строку JSON или уже распарсенный объект (например, `payload` из Supabase).
 * `content` нужен для миграции схемы 1 (пороги работ); без него старый сейв не читается.
 */
export function decodeState(raw: unknown, content?: GameContent): GameState | null {
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
  if (schemaVersion === 1 && !content) return null
  const legacy = schemaVersion === 1
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
    let rank: number
    if (legacy) {
      rank = Math.max(0, ...content!.milestoneLevels(id).filter((l) => l <= level))
    } else {
      if (!isInt(job.rank) || job.rank < 0) return null
      rank = job.rank
    }
    parsedJobs[id] = { level, rank, hasManager, startedAt: startedAt as number | null }
  }

  let upgrades: string[]
  let ui: UiState
  if (legacy) {
    upgrades = []
    ui = { ...newUiState(), tutorialDone: Object.values(parsedJobs).some((j) => j.hasManager) }
  } else {
    if (!isStrings(value.upgrades) || !isObject(value.ui)) return null
    const u = value.ui
    if (typeof u.tutorialDone !== 'boolean' || !isInt(u.tutorialStep) || u.tutorialStep < 0) return null
    if (!isStrings(u.sections) || !isStrings(u.hintsSeen)) return null
    upgrades = [...value.upgrades]
    ui = { tutorialDone: u.tutorialDone, tutorialStep: u.tutorialStep, sections: [...u.sections], hintsSeen: [...u.hintsSeen] }
  }

  return {
    schemaVersion: CURRENT_SCHEMA,
    money,
    lifetimeEarnings,
    jobs: parsedJobs,
    lastActiveAt,
    settings: { language: settings.language, haptics: settings.haptics },
    upgrades,
    ui,
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isInt = (v: unknown): v is number => isNum(v) && Number.isInteger(v)
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')
