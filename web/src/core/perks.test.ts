import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bundledContent } from './bundled.ts'
import { makeClock, makeEngine } from './testkit.ts'
import { activeEffects, grantPerk, inventoryCount } from './perks.ts'
import { bulkCost } from './economy.ts'

const managedReboot = (s: any) => { s.jobs.reboot = { level: 10, rank: 0, hasManager: true, startedAt: 0 } }

test('grantPerk fills the backpack; inventoryCount sums it', () => {
  const e = makeEngine(makeClock())
  grantPerk(e.state, 'speed_100_5')
  grantPerk(e.state, 'speed_100_5')
  grantPerk(e.state, 'rewind_10')
  assert.deepEqual(e.state.perks.inventory, { speed_100_5: 2, rewind_10: 1 })
  assert.equal(inventoryCount(e.state), 3)
})

test('speed and salary perks change cycle and payout', () => {
  const c = makeClock()
  const e = makeEngine(c, managedReboot)
  assert.equal(e.cycle('reboot'), 0.6)
  assert.equal(e.payout('reboot'), 10)
  grantPerk(e.state, 'speed_100_5')
  grantPerk(e.state, 'salary_30_5')
  assert.equal(e.activatePerk('speed_100_5'), true)
  assert.equal(e.activatePerk('salary_30_5'), true)
  assert.equal(e.cycle('reboot'), 0.3)
  assert.equal(e.payout('reboot'), 13)
  assert.deepEqual(e.state.perks.inventory, {})
  assert.equal(e.activatePerk('speed_100_5'), false, 'рюкзак пуст')
})

test('activeEffects lists running perks by time left', () => {
  const c = makeClock()
  const e = makeEngine(c)
  grantPerk(e.state, 'salary_10_10')
  grantPerk(e.state, 'speed_100_5')
  e.activatePerk('salary_10_10')
  e.activatePerk('speed_100_5')
  c.t = 60_000
  assert.deepEqual(activeEffects(bundledContent, e.state, c.t).map((x) => [x.perk.id, x.remaining]), [['speed_100_5', 240], ['salary_10_10', 540]])
})

test('a perk switched on mid-cycle keeps the cycle fraction', () => {
  const c = makeClock()
  const e = makeEngine(c, managedReboot)
  c.t = 300
  grantPerk(e.state, 'speed_100_5')
  e.activatePerk('speed_100_5')
  const st = e.status('reboot')
  assert.equal(st.kind, 'running')
  assert.ok(Math.abs((st as any).progress - 0.5) < 1e-9)
  c.t = 450
  assert.equal(e.advance(c.t), 10, 'оставшаяся половина цикла прошла вдвое быстрее')
})

test('offline: a perk that expired while away boosts income only until it expired', () => {
  const c = makeClock()
  const e = makeEngine(c, managedReboot)
  grantPerk(e.state, 'speed_100_5')
  e.activatePerk('speed_100_5') // до t = 5 мин
  c.t = 600_000
  const report = e.resume(c.t)!
  const expected = (300 / 0.3 + 300 / 0.6) * 10
  assert.ok(Math.abs(report.earned - expected) <= 10, `${report.earned} vs ${expected}`)
  assert.deepEqual(e.state.perks.active, [])
})

test('max buy with a 50% discount pays exactly the quoted price and stays under the cap', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 3, rank: 0, hasManager: false, startedAt: 0 }; s.money = 50 })
  e.state.perks.active.push({ id: 'level_25_60', until: 3_600_000 }, { id: 'level_25_30', until: 3_600_000 })
  const q = e.quote('reboot', 'max')
  assert.ok(q.cost <= 50)
  assert.ok(Math.abs(q.cost - 0.5 * bulkCost(4, 1.07, 3, q.count)) < 1e-9)
  assert.ok(q.count <= e.cap('reboot') - 3)
  assert.equal(e.buy('reboot', 'max'), true)
  assert.ok(Math.abs(e.state.money - (50 - q.cost)) < 1e-9)
  assert.ok(e.state.money >= 0)
})

test('promotion at the cap is not discounted', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 25, rank: 0, hasManager: false, startedAt: 0 } })
  const full = e.promotionCost('reboot')
  e.state.perks.active.push({ id: 'level_25_60', until: 3_600_000 })
  assert.equal(e.quote('reboot', 'one').cost, full)
})

test('counters for quests: collects, hires, upgrades, earned', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.money = 1e9; s.jobs.reboot.rank = 25; s.jobs.reboot.level = 26 })
  c.t = 1000
  e.tap('reboot')
  assert.equal(e.state.stats.collects, 1)
  assert.ok(e.state.stats.earned > 0)
  e.hireManager('reboot')
  assert.equal(e.state.stats.hires, 1)
  e.buyUpgrade(bundledContent.upgrades[0].id)
  assert.equal(e.state.stats.upgrades, 1)
})
