import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bundledContent } from './bundled.ts'
import { makeClock, makeEngine } from './testkit.ts'

test('at the cap the manager stops: no auto income, no offline income', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 49, rank: 25, hasManager: true, startedAt: 0 }; s.money = 1e6 })
  assert.equal(e.buy('reboot', 'one'), true)
  assert.equal(e.atCap('reboot'), true)
  assert.equal(e.managerWaiting('reboot'), true)
  c.t += 60_000
  assert.equal(e.advance(c.t), 0)
  c.t += 3_600_000
  assert.equal(e.resume(c.t)?.earned, 0)
  assert.equal(e.incomePerSecond, 0)
})

test('at the cap the job can still be worked by hand — no dead end', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 50, rank: 25, hasManager: true, startedAt: null } })
  assert.equal(e.status('reboot').kind, 'running', 'работа идёт и без менеджера')
  c.t += 300
  assert.deepEqual(e.status('reboot'), { kind: 'ready' })
  e.tap('reboot')
  assert.equal(e.state.money, 50)
})

test('without a manager the cap does not stop manual work', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 24, rank: 0, hasManager: false, startedAt: 0 }; s.money = 1e6 })
  c.t += 100
  e.buy('reboot', 'one')
  assert.equal(e.status('reboot').kind, 'running')
})

test('promotion restarts a managed job', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 50, rank: 25, hasManager: true, startedAt: null }; s.money = 1e9 })
  assert.ok(e.promote('reboot'))
  assert.equal(e.managerWaiting('reboot'), false)
  c.t += 1500
  assert.ok(e.advance(c.t) > 0)
})

test('cycles shorter than 0.25 s with a manager are shown as a steady stream', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 60, rank: 50, hasManager: true, startedAt: 0 } })
  assert.equal(e.cycle('reboot'), 0.15)
  assert.equal(e.status('reboot').kind, 'streaming')
})

test('every job can eventually reach a sub-0.25 s cycle', () => {
  const c = bundledContent
  const globals = c.milestones.filter((m) => m.jobId === null && m.effect === 'speed' && m.level <= 50)
    .reduce((p, m) => p * m.value, 1)
  for (const job of c.jobs) {
    const own = c.milestones.filter((m) => m.jobId === job.id && m.effect === 'speed').reduce((p, m) => p * m.value, 1)
    assert.ok(job.time / own / globals < 0.25, `${job.id}: ${job.time / own / globals} с`)
  }
})
