// Сохраняемое состояние игры. Время — миллисекунды Unix, длительности — секунды.
import type { GameContent } from './content.ts'
import type { AppLanguage } from './format.ts'

export type JobState = {
  level: number
  hasManager: boolean
  /** Начало текущего цикла (мс); null — работа стоит (ждёт тапа). */
  startedAt: number | null
}

export type PlayerSettings = {
  language: AppLanguage
  haptics: boolean
}

/** Всё, что сохраняется. Меняя формат — увеличь `CURRENT_SCHEMA`. */
export type GameState = {
  schemaVersion: number
  money: number
  lifetimeEarnings: number
  jobs: Record<string, JobState>
  lastActiveAt: number
  settings: PlayerSettings
}

export const CURRENT_SCHEMA = 1

/** Новая игра: первая работа открыта (уровень 1), остальные закрыты. */
export function newGame(content: GameContent, now: number, language: AppLanguage): GameState {
  const jobs: Record<string, JobState> = {}
  content.jobs.forEach((job, index) => {
    jobs[job.id] = { level: index === 0 ? 1 : 0, hasManager: false, startedAt: null }
  })
  return {
    schemaVersion: CURRENT_SCHEMA,
    money: 0,
    lifetimeEarnings: 0,
    jobs,
    lastActiveAt: now,
    settings: { language, haptics: true },
  }
}

export type BuyMode = 'one' | 'ten' | 'hundred' | 'max'
const buyModes: readonly BuyMode[] = ['one', 'ten', 'hundred', 'max']

/** Следующий режим для кнопки «Купить ×N». */
export function nextBuyMode(mode: BuyMode): BuyMode {
  return buyModes[(buyModes.indexOf(mode) + 1) % buyModes.length]
}

export type JobStatus =
  /** Уровень 0. `requirementMet` — выполнено ли условие по предыдущей работе. */
  | { kind: 'locked'; requirementMet: boolean }
  /** Открыта, цикл не запущен — ждёт тапа. */
  | { kind: 'idle' }
  | { kind: 'running'; progress: number; remaining: number }
  /** Цикл закончился, деньги ждут сбора (только без менеджера). */
  | { kind: 'ready' }
  /** Цикл быстрее порога: показываем доход в секунду. */
  | { kind: 'streaming'; perSecond: number }

export type OfflineReport = {
  /** Сколько реально не было игрока, секунды. */
  elapsed: number
  /** Заработано за это время (с учётом оффлайн-лимита). */
  earned: number
  /** Работы без менеджера, ждущие сбора. */
  readyJobs: number
}
