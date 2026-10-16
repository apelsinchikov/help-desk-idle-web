import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeClock, makeEngine } from './testkit.ts'
import { energyCans } from './energy.ts'

const MIN = 60_000

test('one drink: 5 minutes of +30% speed, one can filled', () => {
  const c = makeClock()
  const e = makeEngine(c)
  assert.deepEqual(energyCans(e.content, e.state, 0), { filled: 0, remaining: 0, canDrink: true })
  assert.equal(e.drinkEnergy(), true)
  assert.equal(e.stats().speed, 0.3)
  assert.deepEqual(energyCans(e.content, e.state, 0), { filled: 1, remaining: 300, canDrink: true })
})

test('drinks stack time, not strength: five drinks = 25 minutes, the sixth is refused', () => {
  const c = makeClock()
  const e = makeEngine(c)
  for (let i = 0; i < 5; i++) assert.equal(e.drinkEnergy(), true)
  assert.equal(e.stats().speed, 0.3)
  assert.deepEqual(energyCans(e.content, e.state, 0), { filled: 5, remaining: 1500, canDrink: false })
  assert.equal(e.drinkEnergy(), false)
})

test('after 5 minutes a can frees up and drinking tops back up to 25 minutes', () => {
  const c = makeClock()
  const e = makeEngine(c)
  for (let i = 0; i < 5; i++) e.drinkEnergy()
  c.t = 5 * MIN
  assert.deepEqual(energyCans(e.content, e.state, c.t), { filled: 4, remaining: 1200, canDrink: true })
  assert.equal(e.drinkEnergy(), true)
  assert.equal(energyCans(e.content, e.state, c.t).remaining, 1500)
})

test('a partly used can still counts as filled until it runs out', () => {
  const c = makeClock()
  const e = makeEngine(c)
  e.drinkEnergy()
  e.drinkEnergy()
  c.t = 7 * MIN // осталось 3 мин — одна банка
  assert.deepEqual(energyCans(e.content, e.state, c.t), { filled: 1, remaining: 180, canDrink: true })
})

test('the boost runs out offline exactly like a perk', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.jobs.reboot = { level: 10, rank: 0, hasManager: true, startedAt: 0 } })
  e.drinkEnergy()
  c.t = 10 * MIN
  const report = e.resume(c.t)!
  const expected = (300 / (0.6 / 1.3) + 300 / 0.6) * 10
  assert.ok(Math.abs(report.earned - expected) <= 20, `${report.earned} vs ${expected}`)
  assert.equal(energyCans(e.content, e.state, c.t).filled, 0)
})
