import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bundledContent as c } from './bundled.ts'
import { bulkCost } from './economy.ts'
import { claimable, coinBonus, coinsTotal, companyStatus, lifetimeFor, offlineHours, reorgRecommended } from './prestige.ts'
import { makeClock, makeEngine } from './testkit.ts'

const { coinFactor, coinScale, coinPower, coinBonus: base, statusBase, statusStep } = c.config.prestige

test('TechCoin grow as a root of lifetime earnings (twice the coins for 2^(1/p) times the money)', () => {
  assert.equal(coinsTotal(c, 0), 0)
  assert.equal(coinsTotal(c, coinScale), coinFactor)
  assert.equal(coinsTotal(c, 2 ** (1 / coinPower) * coinScale), 2 * coinFactor)
  assert.equal(coinsTotal(c, lifetimeFor(c, 37) * 1.0000001), 37)
  assert.equal(coinsTotal(c, lifetimeFor(c, 37) * 0.999), 36)
})

test('claimable counts only coins not taken by earlier reorganizations', () => {
  const e = makeEngine(makeClock(), (s) => { s.lifetimeEarnings = lifetimeFor(c, 50) * 1.001; s.coins.claimed = 20 })
  assert.equal(claimable(c, e.state), 30)
})

test('company status grows geometrically with coins ever claimed', () => {
  assert.deepEqual(companyStatus(c, 0), { level: 0, from: 0, next: statusBase })
  assert.equal(companyStatus(c, statusBase).level, 1)
  assert.equal(companyStatus(c, statusBase * statusStep - 1).level, 1)
  assert.equal(companyStatus(c, statusBase * statusStep).level, 2)
  assert.equal(companyStatus(c, 1e12).next, null, 'последний статус')
})

test('every coin on balance adds its bonus to every payout', () => {
  const clock = makeClock()
  const e = makeEngine(clock, (s) => { s.jobs.reboot.level = 10 })
  const plain = e.payout('reboot')
  e.state.coins = { balance: 50, claimed: 50, upgrades: [], mentors: [] }
  assert.ok(Math.abs(e.payout('reboot') - plain * (1 + 50 * base)) < 1e-9)
  e.state.coins.claimed = statusBase
  assert.ok(Math.abs(coinBonus(c, e.state) - (base + c.config.prestige.statusBonus)) < 1e-12, 'статус 1 — +1% за монету')
})

test('reorganization: coins in, the run starts over, permanent progress stays', () => {
  const clock = makeClock(1000)
  const e = makeEngine(clock, (s) => {
    s.money = 1e20
    s.lifetimeEarnings = lifetimeFor(c, 42) * 1.001
    s.jobs.reboot = { level: 300, rank: 300, hasManager: true, startedAt: 0 }
    s.jobs.plug_mouse = { level: 120, rank: 100, hasManager: true, startedAt: 0 }
    s.upgrades = ['reboot_x3']
    s.stars = 33
    s.items = { owned: ['helpdesk_cap'], equipped: { head: 'helpdesk_cap' }, seen: [] }
    s.perks.inventory = { rewind_10: 2 }
    s.quests.active = [{ id: 5, kind: 'level', jobId: 'plug_mouse', target: 150, base: 0 }]
    s.quests.seq = 5
    s.ui.tutorialDone = true
  })
  const lifetime = e.state.lifetimeEarnings
  const claim = e.reorganize()!
  assert.ok(claim >= 42)
  const s = e.state
  assert.equal(s.money, 0)
  assert.deepEqual(s.jobs.reboot, { level: 1, rank: 0, hasManager: false, startedAt: clock.t })
  assert.deepEqual(s.jobs.plug_mouse, { level: 0, rank: 0, hasManager: false, startedAt: null })
  assert.deepEqual(s.upgrades, [])
  assert.deepEqual(s.coins, { balance: claim, claimed: claim, upgrades: [], mentors: [] })
  assert.equal(s.reorgs, 1)
  assert.ok(s.lifetimeEarnings >= lifetime, 'деньги за всё время копятся дальше')
  assert.equal(s.stars, 33)
  assert.deepEqual(s.items.equipped, { head: 'helpdesk_cap' })
  assert.deepEqual(s.perks.inventory, { rewind_10: 2 })
  assert.deepEqual(s.quests.active, [], 'задания под старый забег — выдадим новые')
  assert.equal(s.quests.seq, 5)
  assert.equal(s.ui.tutorialDone, true)
  assert.equal(e.reorganize(), null, 'сразу второй раз — нечего получать')
})

test('reorganization needs at least one coin', () => {
  const e = makeEngine(makeClock(), (s) => { s.lifetimeEarnings = lifetimeFor(c, 1) * 0.99 })
  assert.equal(e.reorganize(), null)
  assert.equal(e.state.reorgs, 0)
})

test('coin upgrades: steps in order, coins leave the balance', () => {
  const e = makeEngine(makeClock(), (s) => { s.coins = { balance: 100, claimed: 100, upgrades: [], mentors: [] } })
  assert.equal(e.canBuyCoinUpgrade('night_shift_8'), false, 'сначала 4 часа')
  assert.equal(e.buyCoinUpgrade('night_shift_4'), true)
  assert.equal(e.state.coins.balance, 100 - c.coinUpgrade('night_shift_4')!.cost)
  assert.equal(e.buyCoinUpgrade('night_shift_4'), false, 'второй раз не купить')
  assert.equal(offlineHours(c, e.state), 4)
})

test('night shift extends offline earnings', () => {
  const clock = makeClock()
  const e = makeEngine(clock, (s) => {
    s.jobs.reboot = { level: 10, rank: 0, hasManager: true, startedAt: 0 }
    s.coins = { balance: 0, claimed: 10, upgrades: ['night_shift_4'], mentors: [] }
  })
  clock.t += 10 * 3_600_000
  const report = e.resume(clock.t)!
  assert.equal(report.counted, 4 * 3600)
  assert.equal(report.earned, 10 * Math.floor(4 * 3600 / 0.6))
})

test('profit x3 for coins multiplies every payout', () => {
  const e = makeEngine(makeClock(), (s) => { s.jobs.reboot.level = 10 })
  const plain = e.payout('reboot')
  e.state.coins = { balance: 0, claimed: 30, upgrades: ['angel_round'], mentors: [] }
  assert.equal(e.payout('reboot'), plain * 3)
})

test('veteran team hires the first managers right after a reorganization', () => {
  const e = makeEngine(makeClock(), (s) => {
    s.lifetimeEarnings = lifetimeFor(c, 5) * 1.01
    s.coins = { balance: 0, claimed: 0, upgrades: ['veteran_team'], mentors: [] }
  })
  e.reorganize()
  const hired = c.jobs.filter((j) => e.state.jobs[j.id].hasManager).map((j) => j.order)
  assert.deepEqual(hired, [1, 2, 3, 4])
})

test('a mentor makes the levels of its job cheaper, not the promotion', () => {
  const e = makeEngine(makeClock(), (s) => { s.jobs.reboot.level = 10; s.money = 1e9 })
  const before = e.quote('reboot', 'one').cost
  e.state.coins = { balance: 10, claimed: 10, upgrades: [], mentors: [] }
  assert.equal(e.hireMentor('reboot'), true)
  assert.equal(e.state.coins.balance, 10 - c.job('reboot')!.mentorCost)
  assert.ok(Math.abs(e.quote('reboot', 'one').cost - before * (1 - c.config.prestige.mentorDiscount)) < 1e-9)
})

test('grade items make promotions cheaper (capped)', () => {
  const e = makeEngine(makeClock(), (s) => { s.jobs.reboot.level = 25 })
  const full = c.config.promotionFactor * bulkCost(4, 1.07, 0, 25)
  assert.ok(Math.abs(e.promotionCost('reboot') - full) < 1e-9)
  const grade = c.items.find((i) => i.stat === 'gradeDiscount')!
  e.state.items = { owned: [grade.id], equipped: { [grade.slot]: grade.id }, seen: [] }
  assert.ok(Math.abs(e.promotionCost('reboot') - full * (1 - grade.value)) < 1e-9)
})

test('HR gift chest costs TechCoin and gives a perk (sometimes an item), the same for the same seed', () => {
  const open = () => {
    const e = makeEngine(makeClock(), (s) => { s.rngSeed = 7; s.coins = { balance: 100, claimed: 100, upgrades: [], mentors: [] } })
    const reward = e.openChest('hr_gift')!
    return { reward, e }
  }
  const { reward, e } = open()
  assert.equal(e.state.coins.balance, 100 - c.chest('hr_gift')!.price!)
  assert.ok(reward.perks.length >= 1)
  for (const id of reward.perks) assert.ok(c.perk(id), id)
  for (const id of reward.items) assert.ok(e.state.items.owned.includes(id))
  assert.deepEqual(open().reward, reward)
  assert.equal(e.openChest('ipo'), null, 'сундуки за печеньки не продаются')
})

test('reorganization is recommended at 10 coins first, then at +50% to the balance', () => {
  const e = makeEngine(makeClock(), (s) => { s.lifetimeEarnings = lifetimeFor(c, 9) * 1.001 })
  assert.equal(reorgRecommended(c, e.state), false)
  e.state.lifetimeEarnings = lifetimeFor(c, 10) * 1.001
  assert.equal(reorgRecommended(c, e.state), true)
  e.state.coins = { balance: 30, claimed: 40, upgrades: [], mentors: [] }
  e.state.lifetimeEarnings = lifetimeFor(c, 54) * 1.001
  assert.equal(reorgRecommended(c, e.state), false)
  e.state.lifetimeEarnings = lifetimeFor(c, 55) * 1.001
  assert.equal(reorgRecommended(c, e.state), true)
})
