// Задания: всегда 3 активных (после обучения), цель — на 5–15 минут при текущем доходе.
import { bulkCost } from './economy.ts'
import type { GameEngine } from './engine.ts'
import { pick, random } from './rng.ts'
import type { Quest, QuestKind } from './state.ts'

const SLOTS = 3

/** Доход в секунду с учётом ручных работ (тап не чаще раза в 2 с): им меряем, сколько займёт цель. */
export function estimatedIncome(engine: GameEngine): number {
  let sum = engine.incomePerSecond
  for (const job of engine.content.jobs) {
    const js = engine.state.jobs[job.id]
    if (js && js.level > 0 && (!js.hasManager || engine.atCap(job.id))) sum += engine.payout(job.id) / Math.max(engine.cycle(job.id), 2)
  }
  return sum
}

/** Округление вверх до двух значащих цифр, минимум 50: «Заработай $13 000». */
export function beautify(x: number): number {
  if (!(x > 50)) return 50
  const p = Math.pow(10, Math.floor(Math.log10(x)) - 1)
  return Math.ceil(x / p - 1e-9) * p
}

export function questProgress(engine: GameEngine, q: Quest): { value: number; target: number } {
  const { stats } = engine.state
  switch (q.kind) {
    case 'level': return { value: engine.level(q.jobId!), target: q.target }
    case 'promote': return { value: engine.rank(q.jobId!) >= q.target ? 1 : 0, target: 1 }
    case 'earn': return { value: stats.earned - q.base, target: q.target }
    case 'collect': return { value: stats.collects - q.base, target: q.target }
    case 'hire': return { value: stats.hires - q.base, target: 1 }
    case 'upgrade': return { value: stats.upgrades - q.base, target: 1 }
    case 'unlock': return { value: engine.level(q.jobId!) > 0 ? 1 : 0, target: 1 }
  }
}

const done = (engine: GameEngine, q: Quest) => {
  const p = questProgress(engine, q)
  return p.value >= p.target
}

/** Возможные задания сейчас (без учёта уже активных). */
function candidates(engine: GameEngine): Omit<Quest, 'id'>[] {
  const { content, state } = engine
  const income = Math.max(estimatedIncome(engine), 1e-9)
  const minSeconds = content.config.quests.minMinutes * 60
  const maxSeconds = content.config.quests.maxMinutes * 60
  const fits = (cost: number) => Number.isFinite(cost) && cost / income <= maxSeconds
  // цель «на 5–15 минут»: слишком быстрые цели не выдаём (кроме самого начала, где всё быстрое — там хватит «Заработай»)
  const inWindow = (cost: number) => fits(cost) && cost / income >= minSeconds
  const f = 1 - engine.stats().levelDiscount
  const list: Omit<Quest, 'id'>[] = []

  // level: самая «тяжёлая» работа, до потолка которой хватит дохода за окно
  let best: { jobId: string; cost: number; cap: number } | null = null
  for (const job of content.jobs) {
    const level = engine.level(job.id)
    const cap = engine.cap(job.id)
    if (level < 1 || engine.atCap(job.id) || !Number.isFinite(cap)) continue
    const cost = bulkCost(job.baseCost, job.growthRate, level, cap - level) * f
    if (inWindow(cost) && (!best || cost > best.cost)) best = { jobId: job.id, cost, cap }
  }
  if (best) list.push({ kind: 'level', jobId: best.jobId, target: best.cap, base: engine.level(best.jobId) })

  const promotable = content.jobs.find((j) => engine.atCap(j.id) && inWindow(engine.promotionCost(j.id)))
  if (promotable) list.push({ kind: 'promote', jobId: promotable.id, target: engine.cap(promotable.id), base: engine.rank(promotable.id) })

  const hireable = content.jobs.some((j) => {
    const js = state.jobs[j.id]
    return js && js.level > 0 && !js.hasManager && js.rank >= content.managerRank(j.id) && fits(j.managerCost)
  })
  if (hireable) list.push({ kind: 'hire', jobId: null, target: 1, base: state.stats.hires })

  const upgrade = content.upgrades.find((u) => !state.upgrades.includes(u.id))
  if (upgrade && fits(upgrade.cost)) list.push({ kind: 'upgrade', jobId: null, target: 1, base: state.stats.upgrades })

  const unlockable = content.jobs.find((j) => {
    const st = engine.status(j.id)
    return st.kind === 'locked' && st.requirementMet
  })
  if (unlockable && fits(unlockable.baseCost)) list.push({ kind: 'unlock', jobId: unlockable.id, target: 1, base: 0 })

  const manual = content.jobs.some((j) => {
    const js = state.jobs[j.id]
    return js && js.level > 0 && (!js.hasManager || engine.atCap(j.id))
  })
  if (manual) {
    const [lo, hi] = content.config.quests.collect
    list.push({ kind: 'collect', jobId: null, target: lo + Math.floor(random(state) * (hi - lo + 1)), base: state.stats.collects })
  }

  list.push({ kind: 'earn', jobId: null, target: beautify(income * 600), base: state.stats.earned })
  return list
}

/** Добирает активные задания до трёх (только после обучения). `exclude` — тип, который сейчас выдавать нельзя. */
export function fillQuests(engine: GameEngine, at: number, exclude?: QuestKind): void {
  const { state } = engine
  if (!state.ui.tutorialDone) return
  void at
  while (state.quests.active.length < SLOTS) {
    const taken = new Set(state.quests.active.map((q) => q.kind))
    const all = candidates(engine).filter((q) => q.kind !== exclude)
    const fresh = all.filter((q) => !taken.has(q.kind))
    // случайный порядок, но «Заработай» — только когда больше нечего
    const pool = fresh.filter((q) => q.kind !== 'earn')
    const next = pool.length > 0 ? pick(state, pool) : fresh[0] ?? all.find((q) => q.kind === 'earn')!
    state.quests.seq++
    state.quests.active.push({ id: state.quests.seq, ...next })
  }
}

/** Засчитывает выполненные: звёзды += выполнено, на их место — новые. Возвращает число выполненных. */
export function completeQuests(engine: GameEngine, at: number): number {
  const { state } = engine
  const finished = state.quests.active.filter((q) => done(engine, q))
  if (finished.length === 0) return 0
  state.quests.active = state.quests.active.filter((q) => !finished.includes(q))
  state.stars += finished.length
  fillQuests(engine, at)
  return finished.length
}

/** Замена задания — бесплатно раз в `rerollHours` часов. */
export function rerollQuest(engine: GameEngine, questId: number, at: number): boolean {
  const { state, content } = engine
  if (at < state.quests.rerollAt) return false
  const q = state.quests.active.find((x) => x.id === questId)
  if (!q) return false
  state.quests.active = state.quests.active.filter((x) => x !== q)
  fillQuests(engine, at, q.kind)
  state.quests.rerollAt = at + content.config.quests.rerollHours * 3600_000
  return true
}
