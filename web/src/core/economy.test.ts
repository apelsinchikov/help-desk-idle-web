import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bulkCost, cycle, maxAffordable, nextCost, payout } from './economy.ts'
import { nextMilestone, speedMultiplier } from './milestones.ts'
import { bundledContent } from './bundled.ts'

const near = (a: number, b: number, eps: number) =>
  assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b} (±${eps})`)

test('nextCost matches Part I example', () => {
  near(nextCost(4, 1.07, 10), 7.87, 0.01)
})

test('bulkCost', () => {
  near(bulkCost(4, 1.07, 0, 10), 55.27, 0.01)
  near(bulkCost(4, 1.07, 7, 1), nextCost(4, 1.07, 7), 1e-9)
  assert.equal(bulkCost(4, 1.07, 0, 0), 0)
})

test('maxAffordable', () => {
  assert.equal(maxAffordable(4, 1.07, 0, 55.27), 10)
  assert.equal(maxAffordable(4, 1.07, 0, 55.26), 9)
  assert.equal(maxAffordable(4, 1.07, 0, 3.99), 0)
  assert.ok(maxAffordable(4, 1.07, 5000, 1e300) >= 0)
})

test('maxAffordable never exceeds money', () => {
  for (const money of [1, 4, 4.28, 99.99, 1234.5, 1e9, 3.3e15, 7.7e40, 1e300]) {
    for (const owned of [0, 1, 25, 333, 4000]) {
      const n = maxAffordable(60, 1.15, owned, money)
      assert.ok(bulkCost(60, 1.15, owned, n) <= money, `money ${money}, owned ${owned}, n ${n}`)
    }
  }
})

test('payout and cycle', () => {
  assert.equal(payout(60, 64, 1), 3840)
  assert.equal(cycle(3, 4), 0.75)
})

test('milestone speed multiplier', () => {
  const c = bundledContent
  const levels: Record<string, number> = Object.fromEntries(c.jobs.map((j) => [j.id, 0]))
  levels.reboot = 112
  assert.equal(speedMultiplier('reboot', levels, c.milestones), 8)
  for (const k of Object.keys(levels)) levels[k] = Math.max(levels[k], 25)
  assert.equal(speedMultiplier('reboot', levels, c.milestones), 16)
  assert.equal(speedMultiplier('plug_mouse', levels, c.milestones), 4)
})

test('next milestone', () => {
  const ms = bundledContent.milestones
  assert.equal(nextMilestone('plug_mouse', 64, ms)?.level, 100)
  assert.equal(nextMilestone('plug_mouse', 0, ms)?.level, 25)
})
