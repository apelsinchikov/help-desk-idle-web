import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeClock, makeEngine } from './testkit.ts'

test('job upgrade triples its payout', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot.level = 10; s.money = 1e8 })
  assert.equal(e.payout('reboot'), 10)
  assert.equal(e.buyUpgrade('reboot_x3'), true)
  assert.equal(e.payout('reboot'), 30)
  assert.equal(e.state.money, 1e8 - 75_000_000)
  assert.equal(e.buyUpgrade('reboot_x3'), false, 'второй раз не купить')
})

test('coffee machine triples every job', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.plug_mouse.level = 2; s.money = 1e13 })
  assert.equal(e.buyUpgrade('coffee_machine'), true)
  assert.equal(e.payout('reboot'), 3)
  assert.equal(e.payout('plug_mouse'), 2 * 60 * 3)
})

test('upgrade without money is refused', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.money = 100 })
  assert.equal(e.canBuyUpgrade('reboot_x3'), false)
  assert.equal(e.buyUpgrade('reboot_x3'), false)
  assert.equal(e.buyUpgrade('nope'), false)
  assert.deepEqual(e.state.upgrades, [])
})
