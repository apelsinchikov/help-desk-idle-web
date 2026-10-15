import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeClock, makeEngine } from './testkit.ts'

test('two hours with manager', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 10, hasManager: true, startedAt: c.t } })
  c.t += 7_200_000
  const report = e.resume(c.t)
  assert.equal(report?.earned, 10 * Math.floor(7200 / 0.6))
  assert.equal(report?.elapsed, 7200)
})

test('thirty days is capped at 24 hours', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 10, hasManager: true, startedAt: c.t } })
  c.t += 30 * 86_400_000
  const report = e.resume(c.t)
  assert.equal(report?.earned, 10 * Math.floor(86_400 / 0.6))
  assert.equal(report?.elapsed, 30 * 86_400)
  assert.ok(Number.isFinite(e.state.money))
})

test('job without manager is ready and not paid', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 10, hasManager: false, startedAt: c.t } })
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
