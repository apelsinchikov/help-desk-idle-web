// Темп игры для «живого» игрока на настоящем ядре (web/src/core).
// Игрок: тапает одну готовую работу раз в TAP с (самую доходную), решает о покупках раз в 10 с:
// менеджер → открыть работу → повышение → улучшение; если ближайшая цель дешевле 5 мин дохода — копит на неё,
// иначе покупает самый выгодный уровень. Играет сессиями: ACTIVE мин в игре, AWAY мин вне игры (доход — только менеджеры).
// Метрика: самая длинная пауза без заметного события (работа / повышение / менеджер / улучшение) во время игры.
// Параметры через env: MS_SMALL, MGR_RANK, PROMO_F, UPG_MUL, MGR_MUL, TAP, ACTIVE, AWAY, HOURS (календарные).
// Запуск из корня репо: node tools/sim/pace.ts
import { bundledContent as base } from '../../web/src/core/bundled.ts'
import { GameContent } from '../../web/src/core/content.ts'
import { GameEngine } from '../../web/src/core/engine.ts'
import { newGame } from '../../web/src/core/state.ts'
import { completeQuests, fillQuests } from '../../web/src/core/quests.ts'
import { claimTrack } from '../../web/src/core/track.ts'

const env = (k: string, d: number) => Number(process.env[k] ?? d)
const cfg = {
  ...base.config,
  managerMinRank: env('MGR_RANK', base.config.managerMinRank),
  promotionFactor: env('PROMO_F', base.config.promotionFactor),
  track: { ...base.config.track, perkFirst: env('PERK_FIRST', base.config.track.perkFirst), perkEvery: env('PERK_EVERY', base.config.track.perkEvery) },
  quests: { ...base.config.quests, minMinutes: env('Q_MIN', base.config.quests.minMinutes), maxMinutes: env('Q_MAX', base.config.quests.maxMinutes) },
}
// MS_SMALL > 0: пороги каждые 25 уровней — существующие остаются, на промежуточных «прибыль ×MS_SMALL»
const small = env('MS_SMALL', 0)
// MS_SPARSE=1 (с 2026-10-16 уже в milestones.json, повторно ничего не меняет): пороги до 100 — каждые 25, 100–300 — каждые 50, 300–1000 — каждые 100, дальше — каждые 250.
// MS_FOLD=1: награды выпавших порогов не теряются, а переносятся на ближайший оставшийся порог выше.
function sparse(list: typeof base.milestones) {
  const keep = (l: number) => l <= 100 ? l % 25 === 0 : l <= 300 ? l % 50 === 0 : l <= 1000 ? l % 100 === 0 : l % 250 === 0
  const out: typeof base.milestones = []
  const carry: Record<string, { speed: number; profit: number }> = {}
  for (const m of [...list].sort((a, b) => a.level - b.level)) {
    if (m.jobId === null || keep(m.level)) {
      const c = m.jobId ? carry[m.jobId] : undefined
      out.push(m)
      if (c && env('MS_FOLD', 0)) {
        if (c.profit !== 1) out.push({ jobId: m.jobId, level: m.level, effect: 'profit' as const, value: c.profit })
        if (c.speed !== 1) out.push({ jobId: m.jobId, level: m.level, effect: 'speed' as const, value: c.speed })
        carry[m.jobId!] = { speed: 1, profit: 1 }
      }
      continue
    }
    const c = (carry[m.jobId] ??= { speed: 1, profit: 1 })
    c[m.effect] *= m.value
  }
  return out
}
function milestones() {
  if (env('MS_SPARSE', 0)) return sparse(base.milestones)
  if (!small) return base.milestones
  const out = [...base.milestones]
  for (const j of base.jobs) {
    const have = new Set(base.milestoneLevels(j.id))
    const last = Math.max(...have)
    for (let l = 25; l <= last; l += 25) if (!have.has(l)) out.push({ jobId: j.id, level: l, effect: 'profit' as const, value: small })
  }
  return out
}
const c = new GameContent(
  base.jobs.map((j, i) => ({ ...j, managerCost: j.managerCost * env('MGR_MUL', 1) * (i < 4 ? env('MGR_EARLY_MUL', 1) : 1),
    ...(process.env.MGR_TIERS ? { managerMinRank: Number(process.env.MGR_TIERS.split(',')[i]) } : {}) })),
  milestones(),
  cfg,
  base.upgrades.map((u) => ({ ...u, cost: u.cost * env('UPG_MUL', 1) })),
  base.perks,
  base.items,
  base.chests,
)
// QUESTS=0 — без этапа 2b (задания, звёзды, перки, вещи)
const QUESTS = env('QUESTS', 1)
const CASUAL = env('CASUAL', 0), SAVE_S = env('SAVE_S', 300), DECIDE_S = env('DECIDE_S', 10)
const TAP = env('TAP', 2), ACTIVE = env('ACTIVE', 30), AWAY = env('AWAY', 120), HOURS = env('HOURS', 72)

let t = 0
const e = new GameEngine(c, newGame(c, 0, 'ru', env('SEED', 7)), () => t)
const s = e.state
s.ui.tutorialDone = true // обучение — первая минута; задания идут после него
let activeMs = 0
let lastEvent = 0
const gaps: { at: number; gap: number }[] = []
const firsts: Record<string, number> = {}
const event = (name: string) => {
  gaps.push({ at: activeMs, gap: activeMs - lastEvent })
  lastEvent = activeMs
  if (firsts[name] === undefined) firsts[name] = t / 3_600_000
}

function goals() {
  const list: { cost: number; act: () => boolean; name: string }[] = []
  for (const j of c.jobs) {
    const js = s.jobs[j.id]
    if (js.rank >= c.managerRank(j.id) && !js.hasManager) list.push({ cost: j.managerCost, act: () => e.hireManager(j.id), name: `M${j.order}` })
    if (js.level === 0 && e.canUnlock(j.id)) list.push({ cost: j.baseCost, act: () => e.unlock(j.id), name: `J${j.order}` })
    if (e.atCap(j.id)) list.push({ cost: e.promotionCost(j.id), act: () => !!e.promote(j.id), name: `P` })
  }
  for (const u of c.upgrades) if (!s.upgrades.includes(u.id)) list.push({ cost: u.cost, act: () => e.buyUpgrade(u.id), name: 'U' })
  return list.sort((a, b) => a.cost - b.cost)
}

function income(): number {
  let sum = e.incomePerSecond
  for (const j of c.jobs) if (s.jobs[j.id].level > 0 && !(s.jobs[j.id].hasManager && !e.atCap(j.id))) {
    sum += e.payout(j.id) / Math.max(e.cycle(j.id), TAP) // ручная работа ограничена скоростью тапов
  }
  return sum
}

/** Этап 2b: задания → звёзды → награды; перки игрок включает сразу, новую вещь надевает. */
function questsTick() {
  if (!QUESTS) return
  fillQuests(e, t)
  if (completeQuests(e, t) === 0) return
  event('S')
  for (const r of claimTrack(e)) {
    event(r.kind === 'item' ? 'I' : 'K')
    if (r.kind === 'perk') e.activatePerk(r.perkId)
    else e.equip(r.itemId)
  }
}

function decide() {
  for (let k = 0; k < 500; k++) {
    const g = goals()
    const affordable = g.find((x) => x.cost <= s.money)
    if (affordable) { if (affordable.act()) { event(affordable.name); continue } }
    const next = g[0]
    if (next && next.cost <= income() * SAVE_S) return // копим на близкую цель
    let best: string | null = null, bestScore = 0
    for (const j of c.jobs) {
      if (s.jobs[j.id].level < 1 || e.atCap(j.id)) continue
      const q = e.quote(j.id, 'one')
      if (q.count < 1 || q.cost > s.money) continue
      // CASUAL=1: покупает самое дешёвое (раскидывает деньги по работам), иначе — лучшее по окупаемости
      const score = CASUAL ? 1 / q.cost : e.payout(j.id) / e.level(j.id) / Math.max(e.cycle(j.id), TAP) / q.cost
      if (score > bestScore) { bestScore = score; best = j.id }
    }
    if (!best || !e.buy(best, 'one')) return
  }
}

const sessionMs = (ACTIVE + AWAY) * 60_000
let nextTap = 0, nextDecide = 0
while (t < HOURS * 3_600_000) {
  const inSession = t % sessionMs < ACTIVE * 60_000
  if (!inSession) {
    // вне игры: прыжок до следующей сессии, доход — только менеджеры (с оффлайн-лимитом)
    const back = (Math.floor(t / sessionMs) + 1) * sessionMs
    t = back
    e.resume(t)
    continue
  }
  t += 500
  activeMs += 500
  e.advance(t)
  if (t >= nextTap) {
    nextTap = t + TAP * 1000
    let pick: string | null = null, best = -1
    for (const j of c.jobs) if (e.status(j.id).kind === 'ready' && e.payout(j.id) > best) { best = e.payout(j.id); pick = j.id }
    if (pick) e.tap(pick)
    questsTick()
  }
  if (t >= nextDecide) { nextDecide = t + DECIDE_S * 1000; decide(); questsTick() }
}

const h = (x: number | undefined) => x === undefined ? '—' : x < 1 ? `${Math.round(x * 60)}м` : `${x.toFixed(1)}ч`
const maxGap = (from: number, to: number) => Math.max(0, ...gaps.filter((g) => g.at > from * 60_000 && g.at <= to * 60_000).map((g) => g.gap)) / 60_000
const tail = (activeMs - lastEvent) / 60_000
console.log(JSON.stringify({
  params: { MS_SMALL: small, MGR_RANK: process.env.MGR_TIERS ?? cfg.managerMinRank, CASUAL, SAVE_S, DECIDE_S, MGR_EARLY_MUL: env('MGR_EARLY_MUL', 1), PROMO_F: cfg.promotionFactor, UPG_MUL: env('UPG_MUL', 1), MGR_MUL: env('MGR_MUL', 1), TAP, ACTIVE, AWAY, HOURS },
  activeHours: +(activeMs / 3_600_000).toFixed(1),
  managers: c.jobs.map((j) => h(firsts[`M${j.order}`])).join(' '),
  jobs: c.jobs.map((j) => h(firsts[`J${j.order}`] ?? (j.order === 1 ? 0 : undefined))).join(' '),
  maxGapMin: { first1hActive: +maxGap(0, 60).toFixed(1), h1to6Active: +maxGap(60, 360).toFixed(1), after6hActive: +maxGap(360, 1e9).toFixed(1), sinceLastEvent: +tail.toFixed(1) },
  events: gaps.length,
  stars: s.stars,
  items: s.items.owned.length,
}))
