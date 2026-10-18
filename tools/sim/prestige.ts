// Долгая симуляция «живого» игрока с реорганизациями (этап 3) на настоящем ядре (web/src/core).
// Игрок заходит сессиями: ACTIVE мин в игре, AWAY мин вне игры, ночью NIGHT_H ч сна (оффлайн-доход — с лимитом).
// В игре: тапает самую доходную готовую работу раз в TAP с, раз в DECIDE_S с покупает (менеджер → открыть работу →
// повышение → улучшение, иначе самый выгодный уровень), включает перки, надевает вещи, ADS=1 — пьёт энергетики.
// Реорганизация — по совету игры (reorgRecommended: первая с FIRST монет, дальше — когда монет хотя бы ×2),
// после неё тратит монеты: «Ночная смена», «Опытная команда», ×3 прибыли, наставники (если цена ≤ SPEND доли счёта).
// Параметры env: DAYS, ACTIVE, AWAY, NIGHT_H, TAP, DECIDE_S, ADS, REORG (0 — без реорганизаций), FIRST, SPEND,
// COIN_SCALE, COIN_FACTOR, SEED. Запуск из корня репо: node tools/sim/prestige.ts
import { bundledContent as base } from '../../web/src/core/bundled.ts'
import { GameContent } from '../../web/src/core/content.ts'
import { GameEngine } from '../../web/src/core/engine.ts'
import { newGame } from '../../web/src/core/state.ts'
import { completeQuests, fillQuests } from '../../web/src/core/quests.ts'
import { claimTrack } from '../../web/src/core/track.ts'
import { energyCans } from '../../web/src/core/energy.ts'
import { claimable, companyStatus, coinUpgradeOpen, reorgRecommended } from '../../web/src/core/prestige.ts'

const env = (k: string, d: number) => Number(process.env[k] ?? d)
const DAYS = env('DAYS', 10), ACTIVE = env('ACTIVE', 30), AWAY = env('AWAY', 120), NIGHT_H = env('NIGHT_H', 8)
const TAP = env('TAP', 2), DECIDE_S = env('DECIDE_S', 10), ADS = env('ADS', 0), REORG = env('REORG', 1)
const FIRST = env('FIRST', 10), SPEND = env('SPEND', 0.25), SAVE_S = 300
// живой игрок реорганизуется не чаще раза в REORG_MIN_H часов (по умолчанию — раз в сутки)
const REORG_MIN_H = env('REORG_MIN_H', 20)
let lastReorgH = -Infinity

const cfg = {
  ...base.config,
  prestige: {
    ...base.config.prestige,
    coinScale: env('COIN_SCALE', base.config.prestige.coinScale),
    coinFactor: env('COIN_FACTOR', base.config.prestige.coinFactor),
    coinPower: env('COIN_POWER', base.config.prestige.coinPower),
  },
}
const c = new GameContent(base.jobs, base.milestones, cfg, base.upgrades, base.perks, base.items, base.chests, base.coinUpgrades)

let t = 0
const e = new GameEngine(c, newGame(c, 0, 'ru', env('SEED', 7)), () => t)
e.state.ui.tutorialDone = true
// START_COINS: монеты на счету с самого начала (замер эластичности дохода по множителю)
if (env('START_COINS', 0) > 0) e.state.coins = { balance: env('START_COINS', 0), claimed: env('START_COINS', 0), upgrades: [], mentors: [] }
const s = () => e.state

let activeMs = 0
let lastEvent = 0
const gaps: { at: number; gap: number }[] = []
const jobFirst: Record<number, number> = {}
const reorgs: { day: number; coins: number; balance: number; status: number; bestJob: number }[] = []
const lifetimeAt: string[] = []
const event = () => { gaps.push({ at: activeMs, gap: activeMs - lastEvent }); lastEvent = activeMs }
const hours = () => t / 3_600_000

function bestJob(): number {
  return Math.max(...c.jobs.filter((j) => s().jobs[j.id].level > 0).map((j) => j.order))
}

function goals() {
  const list: { cost: number; act: () => boolean }[] = []
  for (const j of c.jobs) {
    const js = s().jobs[j.id]
    if (js.rank >= c.managerRank(j.id) && !js.hasManager) list.push({ cost: j.managerCost, act: () => e.hireManager(j.id) })
    if (js.level === 0 && e.canUnlock(j.id)) list.push({ cost: j.baseCost, act: () => e.unlock(j.id) })
    if (e.atCap(j.id)) list.push({ cost: e.promotionCost(j.id), act: () => !!e.promote(j.id) })
  }
  for (const u of c.upgrades) if (!s().upgrades.includes(u.id)) list.push({ cost: u.cost, act: () => e.buyUpgrade(u.id) })
  return list.sort((a, b) => a.cost - b.cost)
}

function income(): number {
  let sum = e.incomePerSecond
  for (const j of c.jobs) if (s().jobs[j.id].level > 0 && !(s().jobs[j.id].hasManager && !e.atCap(j.id))) {
    sum += e.payout(j.id) / Math.max(e.cycle(j.id), TAP)
  }
  return sum
}

function spendCoins() {
  const order = ['night_shift_4', 'veteran_team', 'night_shift_8', 'angel_round', 'night_shift_12', 'charisma_1', 'venture_fund', 'night_shift_24', 'charisma_2', 'sovereign_fund']
  for (let again = true; again;) {
    again = false
    for (const id of order) {
      const up = c.coinUpgrade(id)!
      if (coinUpgradeOpen(s(), up) && up.cost <= s().coins.balance * SPEND && e.buyCoinUpgrade(id)) again = true
    }
    for (const j of [...c.jobs].reverse()) {
      if (!s().coins.mentors.includes(j.id) && j.mentorCost <= s().coins.balance * SPEND * 0.4 && e.hireMentor(j.id)) again = true
    }
  }
}

function decide() {
  if (REORG && hours() - lastReorgH >= REORG_MIN_H && reorgRecommended(c, s(), FIRST)) {
    lastReorgH = hours()
    const before = bestJob()
    const got = e.reorganize()
    if (got) {
      reorgs.push({ day: +(hours() / 24).toFixed(2), coins: got, balance: s().coins.balance, status: companyStatus(c, s().coins.claimed).level, bestJob: before })
      spendCoins()
      event()
    }
  }
  for (let k = 0; k < 500; k++) {
    const g = goals()
    const affordable = g.find((x) => x.cost <= s().money)
    if (affordable) { if (affordable.act()) { event(); continue } }
    const next = g[0]
    if (next && next.cost <= income() * SAVE_S) break
    let best: string | null = null, bestScore = 0
    for (const j of c.jobs) {
      if (s().jobs[j.id].level < 1 || e.atCap(j.id)) continue
      const q = e.quote(j.id, 'one')
      if (q.count < 1 || q.cost > s().money) continue
      const score = e.payout(j.id) / e.level(j.id) / Math.max(e.cycle(j.id), TAP) / q.cost
      if (score > bestScore) { bestScore = score; best = j.id }
    }
    if (!best || !e.buy(best, 'one')) break
  }
  const top = bestJob()
  if (jobFirst[top] === undefined) jobFirst[top] = hours()
  if (ADS && energyCans(c, s(), t).canDrink) e.drinkEnergy()
}

function questsTick() {
  fillQuests(e, t)
  if (completeQuests(e, t) === 0) return
  event()
  for (const r of claimTrack(e)) {
    if (r.kind === 'perk') e.activatePerk(r.perkId)
    else e.equip(r.itemId)
  }
}

const sessionMs = (ACTIVE + AWAY) * 60_000
const DAY = 24 * 3_600_000
let nextTap = 0, nextDecide = 0, nextMark = DAY
while (t < DAYS * DAY) {
  if (t >= nextMark) { lifetimeAt.push(`д${Math.round(nextMark / DAY)}: ${s().lifetimeEarnings.toExponential(2)}`); nextMark += DAY }
  if (NIGHT_H > 0 && t % DAY >= DAY - NIGHT_H * 3_600_000) { t = (Math.floor(t / DAY) + 1) * DAY; e.resume(t); continue }
  if (t % sessionMs >= ACTIVE * 60_000) { t = (Math.floor(t / sessionMs) + 1) * sessionMs; e.resume(t); continue }
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

const maxGap = (fromH: number, toH: number) =>
  Math.max(0, ...gaps.filter((g) => g.at > fromH * 3_600_000 && g.at <= toH * 3_600_000).map((g) => g.gap)) / 60_000
const h = (x: number | undefined) => x === undefined ? '—' : x < 24 ? `${x.toFixed(1)}ч` : `${(x / 24).toFixed(1)}д`
console.log(JSON.stringify({
  params: { REORG_MIN_H, coinPower: cfg.prestige.coinPower, DAYS, ACTIVE, AWAY, NIGHT_H, TAP, ADS, REORG, FIRST, SPEND, coinScale: cfg.prestige.coinScale, coinFactor: cfg.prestige.coinFactor },
  activeHours: +(activeMs / 3_600_000).toFixed(1),
  bestJobFirstReached: Object.entries(jobFirst).map(([o, x]) => `${o}:${h(x)}`).join(' '),
  reorgs,
  claimableNow: claimable(c, s()),
  coins: s().coins,
  status: companyStatus(c, s().coins.claimed).level,
  maxGapMin: { activeH0to2: +maxGap(0, 2).toFixed(1), activeH2to10: +maxGap(2, 10).toFixed(1), activeAfter10: +maxGap(10, 1e9).toFixed(1) },
  lifetimeAt,
  stars: s().stars,
  items: s().items.owned.length,
}, null, 1))
