// Симулятор баланса на настоящем ядре игры (web/src/core).
// «Идеальный» игрок: тапает раз в секунду, жадно покупает — менеджер → открыть работу → повышение →
// улучшение → самый выгодный уровень. Печатает, на каком часу открылись работы, наняты менеджеры, пройдены ранги.
// Запуск из корня репо: node tools/sim/run.ts [часы=72] [--no-upgrades]
import { bundledContent as c } from '../../web/src/core/bundled.ts'
import { GameEngine } from '../../web/src/core/engine.ts'
import { newGame } from '../../web/src/core/state.ts'

const hours = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 72)
const useUpgrades = !process.argv.includes('--no-upgrades')
let t = 0
const e = new GameEngine(c, newGame(c, 0, 'ru'), () => t)
const s = e.state
const events: [string, number][] = []
const mark = (name: string) => events.push([name, t / 3_600_000])

function shop(): boolean {
  for (const j of c.jobs) if (e.canHireManager(j.id) && e.hireManager(j.id)) { mark(`менеджер ${j.order}`); return true }
  for (const j of c.jobs) if (e.canUnlock(j.id) && e.unlock(j.id)) { mark(`работа ${j.order}`); return true }
  for (const j of c.jobs) {
    if (e.atCap(j.id) && e.promotionCost(j.id) <= s.money) {
      const cap = e.cap(j.id)
      e.promote(j.id)
      if (j.order === 8 || cap >= 100) mark(`ранг ${cap} работы ${j.order}`)
      return true
    }
  }
  if (useUpgrades) for (const u of c.upgrades) if (e.canBuyUpgrade(u.id) && e.buyUpgrade(u.id)) { mark(`улучшение ${u.id}`); return true }
  let best: string | null = null
  let bestScore = 0
  for (const j of c.jobs) {
    if (e.level(j.id) < 1 || e.atCap(j.id)) continue
    const q = e.quote(j.id, 'one')
    if (q.count < 1 || q.cost > s.money) continue
    const score = e.payout(j.id) / e.level(j.id) / e.cycle(j.id) / q.cost
    if (score > bestScore) { bestScore = score; best = j.id }
  }
  return best !== null && e.buy(best, 'one')
}

while (t < hours * 3_600_000) {
  t += 1000
  e.advance(t)
  for (const j of c.jobs) {
    const st = e.status(j.id).kind
    if (st === 'idle' || st === 'ready') e.tap(j.id)
  }
  for (let i = 0; i < 200 && shop(); i++);
}

const fmt = (h: number) => (h < 1 ? `${Math.round(h * 60)} мин` : `${h.toFixed(1)} ч`)
for (const [name, h] of events) if (!name.startsWith('улучшение') || name.includes('coffee')) console.log(fmt(h).padStart(9), name)
console.log(`\nЗа ${hours} ч: деньги ${s.money.toExponential(2)}, всего заработано ${s.lifetimeEarnings.toExponential(2)}`)
