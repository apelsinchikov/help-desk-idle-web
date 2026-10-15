import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeClock, makeEngine } from './testkit.ts'

test('two hours with manager', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 10, rank: 0, hasManager: true, startedAt: c.t } })
  c.t += 7_200_000
  const report = e.resume(c.t)
  assert.equal(report?.earned, 10 * Math.floor(7200 / 0.6))
  assert.equal(report?.elapsed, 7200)
})

test('thirty days is capped at 24 hours', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 10, rank: 0, hasManager: true, startedAt: c.t } })
  c.t += 30 * 86_400_000
  const report = e.resume(c.t)
  assert.equal(report?.earned, 10 * Math.floor(86_400 / 0.6))
  assert.equal(report?.elapsed, 30 * 86_400)
  assert.ok(Number.isFinite(e.state.money))
})

test('job without manager is ready and not paid', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 10, rank: 0, hasManager: false, startedAt: c.t } })
  c.t += 3_600_000
  const report = e.resume(c.t)
  assert.equal(report?.readyJobs, 1)
  assert.equal(report?.earned, 0)
})

test('short absence and clock backwards give no report', () => {
  const c = makeClock()
  const e = makeEngine(c)
  c.t += 30_000
  assert.equal(e.resume(c.t), null)
  c.t -= 3_600_000
  assert.equal(e.resume(c.t), null)
})

test('clock moved back then forward pays at most the 24 h cap', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 10, rank: 0, hasManager: true, startedAt: c.t } })
  c.t -= 30 * 86_400_000
  e.resume(c.t)
  c.t += 30 * 86_400_000 + 10_000
  const report = e.resume(c.t)
  assert.ok(e.state.money <= 10 * Math.floor(86_400 / 0.6), `money ${e.state.money}`)
  assert.notEqual(report, null, 'большой скачок вперёд показывает «С возвращением»')
})

test('a long gap between ticks goes through the cap too', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 10, rank: 0, hasManager: true, startedAt: c.t } })
  c.t += 100
  e.resume(c.t)
  c.t += 3 * 86_400_000
  e.resume(c.t)
  assert.ok(e.state.money <= 10 * Math.floor(86_400 / 0.6) + 10, `money ${e.state.money}`)
})
