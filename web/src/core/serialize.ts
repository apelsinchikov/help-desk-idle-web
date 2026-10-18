// GameState ⇄ JSON. Битый, чужой или «из будущего» сейв → null (игра не падает).
// Схема 1 (этап 1) мигрирует в 2: ранг по уже достигнутым порогам, пустые улучшения, состояние обучения.
// Схема 2 мигрирует в 3: задания, звёзды, перки и вещи — пустые. Схема 3 → 4: TechCoin пустые, тема «Офис».
import type { GameContent } from './content.ts'
import { CURRENT_SCHEMA, QUEST_KINDS, newCoins, newGame, newStage2b, newUiState, randomSeed } from './state.ts'
import type { CoinState, GameState, JobState, Quest, UiState } from './state.ts'
import { SLOTS } from './content.ts'
import type { Slot } from './content.ts'

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
    ui = { tutorialDone: u.tutorialDone, tutorialStep: u.tutorialStep, sections: [...u.sections], hintsSeen: [...u.hintsSeen], ticketCursor: 0, wiped: u.wiped === true }
  }

  let stage2b = newStage2b(randomSeed())
  if (schemaVersion >= 3) {
    const parsed = decodeStage2b(value, content)
    if (!parsed) return null
    stage2b = parsed.stage2b
    ui.ticketCursor = parsed.ticketCursor
  }

  let coins = newCoins()
  let reorgs = 0
  if (schemaVersion >= 4) {
    const parsed = decodeCoins(value.coins, content)
    if (!parsed || !isCount(value.reorgs)) return null
    coins = parsed
    reorgs = value.reorgs
  }

  const season = isInt(value.season) ? value.season : 1
  const decoded: GameState = {
    schemaVersion: CURRENT_SCHEMA,
    money,
    lifetimeEarnings,
    jobs: parsedJobs,
    lastActiveAt,
    settings: { language: settings.language, haptics: settings.haptics, theme: settings.theme === 'night' ? 'night' : 'office' },
    upgrades,
    ui,
    ...stage2b,
    season,
    coins,
    reorgs,
  }
  return content && season < content.config.saveSeason ? wipe(decoded, content) : decoded
}

/** Вайп сейва прошлого сезона: новая игра; остаются настройки, пройденное обучение и подсказки; перк-компенсация. */
function wipe(old: GameState, content: GameContent): GameState {
  const fresh = newGame(content, old.lastActiveAt, old.settings.language)
  fresh.settings = { ...old.settings }
  fresh.ui.tutorialDone = old.ui.tutorialDone
  fresh.ui.tutorialStep = old.ui.tutorialStep
  fresh.ui.hintsSeen = [...old.ui.hintsSeen]
  fresh.ui.wiped = true
  if (content.perk(content.config.wipeCompensation)) fresh.perks.inventory[content.config.wipeCompensation] = 1
  return fresh
}

/** Схема 4: TechCoin. Монет на счету не больше полученных; неизвестные улучшения и работы выбрасываются. */
function decodeCoins(raw: unknown, content?: GameContent): CoinState | null {
  if (!isObject(raw)) return null
  const { balance, claimed, upgrades, mentors } = raw
  if (!isCount(balance) || !isCount(claimed) || !isStrings(upgrades) || !isStrings(mentors)) return null
  return {
    balance: Math.min(balance, claimed),
    claimed,
    upgrades: [...new Set(upgrades.filter((id) => !content || !!content.coinUpgrade(id)))],
    mentors: [...new Set(mentors.filter((id) => !content || !!content.job(id)))],
  }
}

/** Поля схемы 3. Неизвестные id перков и вещей (контент поменялся) выбрасываются, если передан `content`. */
function decodeStage2b(value: Record<string, unknown>, content?: GameContent) {
  const { stars, track, quests, stats, perks, items, rngSeed, ui } = value
  if (!isCount(stars) || !isInt(rngSeed) || rngSeed < 0) return null
  if (!isObject(track) || !isCount(track.claimed)) return null
  if (!isObject(ui) || !isCount(ui.ticketCursor)) return null
  if (!isObject(quests) || !Array.isArray(quests.active) || !isNum(quests.rerollAt) || !isCount(quests.seq)) return null
  const active: Quest[] = []
  for (const q of quests.active) {
    if (!isObject(q) || !isCount(q.id) || !QUEST_KINDS.includes(q.kind as Quest['kind'])) return null
    if (q.jobId !== null && typeof q.jobId !== 'string') return null
    if (!isNum(q.target) || !isNum(q.base)) return null
    const kind = q.kind as Quest['kind']
    const jobId = q.jobId as string | null
    // задание на работу — только с существующей работой; больше трёх — лишние
    if ((kind === 'level' || kind === 'promote' || kind === 'unlock') && (jobId === null || (content && !content.job(jobId)))) continue
    if (active.length < 3) active.push({ id: q.id, kind, jobId, target: q.target, base: q.base })
  }
  if (!isObject(stats)) return null
  const { collects, hires, upgrades, earned } = stats
  if (!isCount(collects) || !isCount(hires) || !isCount(upgrades) || !isNum(earned) || earned < 0) return null
  if (!isObject(perks) || !isObject(perks.inventory) || !Array.isArray(perks.active)) return null
  const knownPerk = (id: string) => !content || !!content.perk(id)
  const knownItem = (id: string) => !content || !!content.item(id)
  const inventory: Record<string, number> = {}
  for (const [id, n] of Object.entries(perks.inventory)) {
    if (!isCount(n)) return null
    if (knownPerk(id) && n > 0) inventory[id] = n
  }
  const activePerks: { id: string; until: number }[] = []
  for (const a of perks.active) {
    if (!isObject(a) || typeof a.id !== 'string' || !isNum(a.until)) return null
    if (knownPerk(a.id)) activePerks.push({ id: a.id, until: a.until })
  }
  if (!isObject(items) || !isStrings(items.owned) || !isObject(items.equipped) || !isStrings(items.seen)) return null
  const owned = [...new Set(items.owned.filter(knownItem))]
  const equipped: Partial<Record<Slot, string>> = {}
  for (const [slot, id] of Object.entries(items.equipped)) {
    if (typeof id !== 'string' || !SLOTS.includes(slot as Slot)) return null
    if (owned.includes(id) && (!content || content.item(id)!.slot === slot)) equipped[slot as Slot] = id
  }
  return {
    ticketCursor: ui.ticketCursor,
    stage2b: {
      stars,
      track: { claimed: Math.min(track.claimed, stars) },
      quests: { active, rerollAt: quests.rerollAt, seq: Math.max(quests.seq, ...active.map((q) => q.id)) },
      stats: { collects, hires, upgrades, earned },
      perks: { inventory, active: activePerks, fresh: isCount(perks.fresh) ? perks.fresh : 0 },
      items: { owned, equipped, seen: items.seen.filter((id) => owned.includes(id)) },
      rngSeed,
    },
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isInt = (v: unknown): v is number => isNum(v) && Number.isInteger(v)
const isCount = (v: unknown): v is number => isInt(v) && v >= 0
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')
