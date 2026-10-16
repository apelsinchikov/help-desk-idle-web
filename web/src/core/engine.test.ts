import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeClock, makeEngine } from './testkit.ts'

const near = (a: number, b: number, eps: number) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`)

test('without a manager the job runs by itself; one tap collects and restarts it', () => {
  const c = makeClock()
  const e = makeEngine(c)
  assert.equal(e.status('reboot').kind, 'running', 'новая игра — работа уже идёт')
  c.t += 600
  assert.deepEqual(e.status('reboot'), { kind: 'ready' })
  assert.equal(e.state.money, 0, 'деньги ждут сбора')
  e.tap('reboot')
  assert.equal(e.state.money, 1)
  assert.equal(e.state.lifetimeEarnings, 1)
  assert.equal(e.status('reboot').kind, 'running', 'после сбора следующий цикл стартует сам')
})

test('a tap while the job is running does nothing', () => {
  const c = makeClock()
  const e = makeEngine(c)
  c.t += 600
  e.tap('reboot')
  e.tap('reboot')
  assert.equal(e.state.money, 1)
  assert.equal(e.status('reboot').kind, 'running')
})

test('an unlocked job starts by itself', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot.level = 25; s.money = 1e6 })
  e.unlock('plug_mouse')
  assert.equal(e.status('plug_mouse').kind, 'running')
})

test('an old save with an idle job gets it started', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot.startedAt = null })
  assert.equal(e.status('reboot').kind, 'running')
})

test('without manager job waits when ready', () => {
  const c = makeClock()
  const e = makeEngine(c)
  e.tap('reboot')
  c.t += 10_000
  e.advance(c.t)
  assert.equal(e.state.money, 0)
  assert.deepEqual(e.status('reboot'), { kind: 'ready' })
})

test('buy one and insufficient money', () => {
  const c = makeClock()
  const poor = makeEngine(c, (s) => { s.money = 3.99 })
  assert.equal(poor.buy('reboot', 'one'), false)
  assert.equal(poor.level('reboot'), 1)

  const rich = makeEngine(c, (s) => { s.money = 100 })
  assert.equal(rich.buy('reboot', 'one'), true)
  assert.equal(rich.level('reboot'), 2)
  near(rich.state.money, 100 - 4.28, 1e-9)
})

test('buy max never negative', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.money = 1000 })
  assert.equal(e.buy('reboot', 'max'), true)
  assert.ok(e.state.money >= 0)
  assert.equal(e.buy('plug_mouse', 'max'), false, 'закрытую работу покупать нельзя')
})

test('unlock requires level 25 and money', () => {
  const c = makeClock()
  const early = makeEngine(c, (s) => { s.jobs.reboot.level = 24; s.money = 1e6 })
  assert.equal(early.unlock('plug_mouse'), false)
  assert.deepEqual(early.status('plug_mouse'), { kind: 'locked', requirementMet: false })

  const ready = makeEngine(c, (s) => { s.jobs.reboot.level = 25; s.money = 1e6 })
  assert.deepEqual(ready.status('plug_mouse'), { kind: 'locked', requirementMet: true })
  assert.equal(ready.unlock('plug_mouse'), true)
  assert.equal(ready.level('plug_mouse'), 1)
  assert.equal(ready.state.money, 1e6 - 60)

  const broke = makeEngine(c, (s) => { s.jobs.reboot.level = 25; s.money = 59 })
  assert.equal(broke.unlock('plug_mouse'), false)
})

test('manager needs the second promotion (rank 50)', () => {
  const c = makeClock()
  const low = makeEngine(c, (s) => { s.jobs.reboot.level = 50; s.jobs.reboot.rank = 25; s.money = 1e6 })
  assert.equal(low.canHireManager('reboot'), false)
  assert.equal(low.hireManager('reboot'), false)
  const ok = makeEngine(c, (s) => { s.jobs.reboot.level = 51; s.jobs.reboot.rank = 50; s.money = 1e6 })
  assert.equal(ok.hireManager('reboot'), true)
})

test('manager auto-collects', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot.level = 100; s.jobs.reboot.rank = 100; s.money = 1000 })
  assert.equal(e.hireManager('reboot'), true)
  assert.equal(e.state.money, 0)
  c.t += 6000
  const earned = e.advance(c.t)
  assert.equal(earned, 100 * 1.5 * Math.floor(6 / 0.075), 'ур. 75 — прибыль ×1,5')
  assert.equal(e.state.money, earned)
  assert.equal(e.hireManager('reboot'), false, 'второй раз нанять нельзя')
})

test('fast cycle is batched', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 300, rank: 300, hasManager: true, startedAt: c.t } })
  const cycle = 0.6 / 32
  assert.equal(e.cycle('reboot'), cycle)
  const pay = 300 * 1.5 ** 7 // промежуточные пороги 75, 125, 150, 175, 225, 250, 275
  assert.deepEqual(e.status('reboot'), { kind: 'streaming', perSecond: pay / cycle })
  c.t += 10_000
  assert.equal(e.advance(c.t), pay * Math.floor(10 / cycle))
})

test('clock moved backwards', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 10, rank: 0, hasManager: true, startedAt: c.t } })
  assert.equal(e.advance(c.t - 3_600_000), 0)
  assert.equal(e.state.money, 0)
  const st = e.status('reboot')
  assert.equal(st.kind, 'running')
  if (st.kind === 'running') assert.ok(st.progress >= 0 && st.progress <= 1)
})

test('quote max when broke shows next price', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.money = 1 })
  const q = e.quote('reboot', 'max')
  assert.equal(q.count, 0)
  near(q.cost, 4.28, 1e-9)
})

test('income per second counts only managed jobs', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 10, rank: 0, hasManager: true, startedAt: c.t } })
  near(e.incomePerSecond, 10 / 0.6, 1e-9)
})

test('save without an entry for some job does not break buying', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => {
    s.money = 1e6
    s.jobs.reboot.level = 25
    delete s.jobs.plug_mouse
  })
  assert.deepEqual(e.status('plug_mouse'), { kind: 'locked', requirementMet: true })
  assert.equal(e.unlock('plug_mouse'), true)
  assert.equal(e.level('plug_mouse'), 1)
  assert.equal(e.state.money, 1e6 - 60)
})

test('starting over keeps the finished tutorial and seen hints', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => {
    s.money = 500
    s.ui.tutorialDone = true
    s.ui.tutorialStep = 8
    s.ui.hintsSeen = ['managers', 'upgrades']
    s.ui.sections = ['settings', 'managers', 'upgrades']
  })
  e.reset(c.t)
  assert.equal(e.state.money, 0)
  assert.equal(e.state.ui.tutorialDone, true)
  assert.deepEqual(e.state.ui.hintsSeen, ['managers', 'upgrades'])
  assert.deepEqual(e.state.ui.sections, ['settings'], 'разделы откроются заново по прогрессу')
})
