// Сохраняемое состояние игры. Время — миллисекунды Unix, длительности — секунды.
import type { GameContent, Slot } from './content.ts'
import type { AppLanguage } from './format.ts'

export type JobState = {
  level: number
  /** Последний оплаченный порог (повышение). Награды порогов считаются по нему. */
  rank: number
  hasManager: boolean
  /** Начало текущего цикла (мс); null — работа стоит (ждёт тапа). */
  startedAt: number | null
}

export type Theme = 'office' | 'night'

export type PlayerSettings = {
  language: AppLanguage
  haptics: boolean
  /** Тема оформления: A «Офис и стикеры» или C «Ночная смена». */
  theme: Theme
}

/**
 * TechCoin: `balance` — на счету (дают бонус к прибыли), `claimed` — получено за все реорганизации (растит статус),
 * `upgrades` — купленные улучшения за монеты, `mentors` — работы с наставником. Реорганизация это не сбрасывает.
 */
export type CoinState = { balance: number; claimed: number; upgrades: string[]; mentors: string[] }

/** Всё, что сохраняется. Меняя формат — увеличь `CURRENT_SCHEMA`. */
export type GameState = {
  schemaVersion: number
  money: number
  lifetimeEarnings: number
  jobs: Record<string, JobState>
  lastActiveAt: number
  settings: PlayerSettings
  /** Купленные улучшения (id из upgrades.json). */
  upgrades: string[]
  ui: UiState
  /** Звёзды за задания (не сбрасываются реорганизацией). */
  stars: number
  /** Последняя звезда, награда за которую уже выдана. */
  track: { claimed: number }
  quests: { active: Quest[]; rerollAt: number; seq: number }
  /** Счётчики для заданий: сборы тапом, наймы, улучшения, заработано всего. */
  stats: { collects: number; hires: number; upgrades: number; earned: number }
  /** Рюкзак (id → сколько штук), включённые перки (до какого момента, мс), сколько перков пришло с прошлого захода в рюкзак. */
  perks: { inventory: Record<string, number>; active: { id: string; until: number }[]; fresh: number }
  /** Вещи: полученные (в порядке получения), надетые по слотам, уже просмотренные в шкафу. */
  items: { owned: string[]; equipped: Partial<Record<Slot, string>>; seen: string[] }
  /** Зерно генератора наград: награды не «перебрасываются» перезагрузкой. */
  rngSeed: number
  /** Сезон сейва (config.saveSeason на момент создания). Старый сезон при загрузке — вайп. */
  season: number
  coins: CoinState
  /** Сколько раз игрок реорганизовал отдел. */
  reorgs: number
}

export type QuestKind = 'level' | 'promote' | 'earn' | 'collect' | 'hire' | 'upgrade' | 'unlock'
export const QUEST_KINDS: readonly QuestKind[] = ['level', 'promote', 'earn', 'collect', 'hire', 'upgrade', 'unlock']
/** Задание: `base` — значение счётчика при выдаче, `target` — цель (уровень, сумма, количество). */
export type Quest = { id: number; kind: QuestKind; jobId: string | null; target: number; base: number }

/** Обучение и разделы меню — в сейве, чтобы не повторялись на другом устройстве. */
export type UiState = {
  tutorialDone: boolean
  tutorialStep: number
  /** Открытые разделы меню. */
  sections: string[]
  /** Разделы, подсказку которых игрок уже видел. */
  hintsSeen: string[]
  /** Следующая заявка в техподдержку из банка (банк проходится целиком без повторов). */
  ticketCursor: number
  /** Прогресс обнулён вайпом — показать окно с компенсацией (один раз). */
  wiped: boolean
}

export const CURRENT_SCHEMA = 4

export const newCoins = (): CoinState => ({ balance: 0, claimed: 0, upgrades: [], mentors: [] })

export const newUiState = (): UiState => ({ tutorialDone: false, tutorialStep: 0, sections: ['settings'], hintsSeen: [], ticketCursor: 0, wiped: false })

export const randomSeed = (): number => Math.floor(Math.random() * 2 ** 32)

/** Пустое состояние этапа 2b (новая игра и миграция старых сейвов). */
export function newStage2b(seed: number) {
  return {
    stars: 0,
    track: { claimed: 0 },
    quests: { active: [] as Quest[], rerollAt: 0, seq: 0 },
    stats: { collects: 0, hires: 0, upgrades: 0, earned: 0 },
    perks: { inventory: {} as Record<string, number>, active: [] as { id: string; until: number }[], fresh: 0 },
    items: { owned: [] as string[], equipped: {} as Partial<Record<Slot, string>>, seen: [] as string[] },
    rngSeed: seed,
  }
}

/** Новая игра: первая работа открыта (уровень 1), остальные закрыты. */
export function newGame(content: GameContent, now: number, language: AppLanguage, seed: number = randomSeed()): GameState {
  const jobs: Record<string, JobState> = {}
  content.jobs.forEach((job, index) => {
    // первая работа открыта и уже идёт (без менеджера работа запускается сама, деньги собираются тапом)
    jobs[job.id] = { level: index === 0 ? 1 : 0, rank: 0, hasManager: false, startedAt: index === 0 ? now : null }
  })
  return {
    schemaVersion: CURRENT_SCHEMA,
    money: 0,
    lifetimeEarnings: 0,
    jobs,
    lastActiveAt: now,
    settings: { language, haptics: true, theme: 'office' },
    upgrades: [],
    ui: newUiState(),
    ...newStage2b(seed),
    season: content.config.saveSeason,
    coins: newCoins(),
    reorgs: 0,
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
  /** За сколько секунд из `elapsed` учтён доход: не больше оффлайн-лимита. */
  counted: number
  /** Работы без менеджера, ждущие сбора. */
  readyJobs: number
}
