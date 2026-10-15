import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeClock, makeEngine } from './testkit.ts'

const near = (a: number, b: number, eps: number) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`)

test('tap starts, then ready, then collect', () => {
  const c = makeClock()
  const e = makeEngine(c)
  assert.deepEqual(e.status('reboot'), { kind: 'idle' })
  e.tap('reboot')
  assert.equal(e.status('reboot').kind, 'running')
  c.t += 600
  assert.deepEqual(e.status('reboot'), { kind: 'ready' })
  assert.equal(e.state.money, 0)
  e.tap('reboot')
  assert.equal(e.state.money, 1)
  assert.equal(e.state.lifetimeEarnings, 1)
  assert.deepEqual(e.status('reboot'), { kind: 'idle' }, 'после сбора работа стоит до нового тапа')
  c.t += 5000
  assert.deepEqual(e.status('reboot'), { kind: 'idle' }, 'сама не стартует')
  e.tap('reboot')
  assert.equal(e.status('reboot').kind, 'running', 'старт только по тапу')
})

test('ready job is collected only once', () => {
  const c = makeClock()
  const e = makeEngine(c)
  e.tap('reboot')
  c.t += 600
  e.tap('reboot')
  e.tap('reboot') // второй тап — это уже новый старт, не второй сбор
  assert.equal(e.state.money, 1)
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

test('manager needs job level 50', () => {
  const c = makeClock()
  const low = makeEngine(c, (s) => { s.jobs.reboot.level = 49; s.money = 1e6 })
  assert.equal(low.canHireManager('reboot'), false)
  assert.equal(low.hireManager('reboot'), false)
  const ok = makeEngine(c, (s) => { s.jobs.reboot.level = 50; s.money = 1e6 })
  assert.equal(ok.hireManager('reboot'), true)
})

test('manager auto-collects', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot.level = 50; s.money = 1000 })
  assert.equal(e.hireManager('reboot'), true)
  assert.equal(e.state.money, 0)
  c.t += 6000
  const earned = e.advance(c.t)
  assert.equal(earned, 50 * Math.floor(6 / 0.6))
  assert.equal(e.state.money, earned)
  assert.equal(e.hireManager('reboot'), false, 'второй раз нанять нельзя')
})

test('fast cycle is batched', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 300, rank: 300, hasManager: true, startedAt: c.t } })
  const cycle = 0.6 / 32
  assert.equal(e.cycle('reboot'), cycle)
  assert.deepEqual(e.status('reboot'), { kind: 'streaming', perSecond: 300 / cycle })
  c.t += 10_000
  assert.equal(e.advance(c.t), 300 * Math.floor(10 / cycle))
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
