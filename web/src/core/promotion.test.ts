import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bulkCost } from './economy.ts'
import { makeClock, makeEngine } from './testkit.ts'

test('buying stops at the milestone cap', () => {
  const c = makeClock()
  const ten = makeEngine(c, (s) => { s.jobs.reboot.level = 24; s.money = 1e12 })
  assert.equal(ten.cap('reboot'), 25)
  assert.equal(ten.quote('reboot', 'ten').count, 1)
  assert.equal(ten.buy('reboot', 'ten'), true)
  assert.equal(ten.level('reboot'), 25)
  const max = makeEngine(c, (s) => { s.money = 1e12 })
  assert.equal(max.buy('reboot', 'max'), true)
  assert.equal(max.level('reboot'), 25)
  assert.equal(max.buy('reboot', 'hundred'), false, 'на потолке уровни не покупаются')
})

test('at the cap the quote is the promotion price', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot.level = 25; s.money = 1e12 })
  assert.equal(e.atCap('reboot'), true)
  const expected = 4 * bulkCost(4, 1.07, 0, 25)
  assert.deepEqual(e.quote('reboot', 'one'), { count: 0, cost: expected })
  assert.equal(e.promotionCost('reboot'), expected)
})

test('promotion needs the cap and the money', () => {
  const c = makeClock()
  const poor = makeEngine(c, (s) => { s.jobs.reboot.level = 25; s.money = 10 })
  assert.equal(poor.promote('reboot'), null)
  assert.equal(poor.rank('reboot'), 0)
  assert.equal(poor.state.money, 10)
  const early = makeEngine(c, (s) => { s.jobs.reboot.level = 20; s.money = 1e12 })
  assert.equal(early.promote('reboot'), null)
  assert.equal(early.state.money, 1e12)
})

test('promotion grants the milestone reward and opens the next segment', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot.level = 25; s.money = 1e12 })
  assert.equal(e.cycle('reboot'), 0.6, 'до оплаты награды нет')
  const gained = e.promote('reboot')!
  assert.deepEqual(gained.map((m) => [m.jobId, m.level, m.effect]), [['reboot', 25, 'speed']])
  assert.equal(e.rank('reboot'), 25)
  assert.equal(e.cap('reboot'), 50)
  assert.equal(e.cycle('reboot'), 0.3)
  assert.equal(e.state.money, 1e12 - 4 * bulkCost(4, 1.07, 0, 25))
})

test('global milestone needs every job promoted', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => {
    for (const id of Object.keys(s.jobs)) { s.jobs[id].level = 25; s.jobs[id].rank = 25 }
    s.jobs.ddos_rivals.rank = 0
    s.money = 1e30
  })
  assert.equal(e.cycle('reboot'), 0.3)
  const gained = e.promote('ddos_rivals')!
  assert.ok(gained.some((m) => m.jobId === null && m.level === 25), 'глобальный порог стал активен')
  assert.equal(e.cycle('reboot'), 0.15)
})
