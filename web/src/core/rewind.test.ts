import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeClock, makeEngine } from './testkit.ts'
import { grantPerk } from './perks.ts'

test('rewind pays managed jobs for the whole interval and uses one perk', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 10, rank: 0, hasManager: true, startedAt: 0 } })
  grantPerk(e.state, 'rewind_10')
  const preview = e.rewindPreview(10)
  assert.equal(preview, 10 * Math.floor(600 / 0.6))
  assert.equal(e.state.money, 0, 'превью ничего не меняет')
  assert.equal(e.activatePerk('rewind_10'), true)
  assert.equal(e.state.money, preview)
  assert.deepEqual(e.state.perks.inventory, {})
  assert.deepEqual(e.state.perks.active, [], 'перемотка не висит активным перком')
})

test('rewind: manager waiting at the cap earns nothing', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 25, rank: 0, hasManager: true, startedAt: 0 } })
  assert.equal(e.rewind(10), 0)
  assert.equal(e.state.money, 0)
})

test('rewind: a job without a manager runs to ready and waits for a tap', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 10, rank: 0, hasManager: false, startedAt: 0 } })
  c.t = 100
  assert.equal(e.rewind(10), 0)
  assert.equal(e.status('reboot').kind, 'ready')
  assert.equal(e.state.money, 0)
  e.tap('reboot')
  assert.equal(e.state.money, 10, 'один цикл, не десять минут')
})

test('rewind does not spend the time of active perks', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 10, rank: 0, hasManager: true, startedAt: 0 } })
  grantPerk(e.state, 'speed_100_5')
  e.activatePerk('speed_100_5')
  const until = e.state.perks.active[0].until
  e.rewind(30)
  assert.equal(e.state.perks.active[0].until, until)
  assert.ok(e.state.money >= 10 * Math.floor(1800 / 0.3) - 10, 'перемотка с текущим бонусом скорости')
})
