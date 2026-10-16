import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bundledContent as c } from './bundled.ts'
import { newGame } from './state.ts'
import { itemTotals, perkTotals, statTotals } from './modifiers.ts'

const fresh = () => newGame(c, 0, 'ru', 1)

test('no items and no perks: all stats are zero', () => {
  assert.deepEqual(statTotals(c, fresh(), 0), { speed: 0, salary: 0, levelDiscount: 0, gradeDiscount: 0 })
})

test('equipped item and active perk add up inside a stat', () => {
  const s = fresh()
  s.items.owned.push('helpdesk_cap')
  s.items.equipped.head = 'helpdesk_cap'
  s.perks.active.push({ id: 'speed_200_5', until: 10_000 })
  assert.equal(statTotals(c, s, 0).speed, 2.5)
  assert.equal(itemTotals(c, s).speed, 0.5)
})

test('two identical perks both count', () => {
  const s = fresh()
  s.perks.active.push({ id: 'speed_100_5', until: 10_000 }, { id: 'speed_100_5', until: 20_000 })
  assert.equal(statTotals(c, s, 0).speed, 2)
})

test('level discount from items and perks together is capped at 60%', () => {
  const s = fresh()
  s.items.owned.push('corp_card')
  s.items.equipped.accessory = 'corp_card'
  s.perks.active.push({ id: 'level_25_5', until: 10_000 }, { id: 'level_25_10', until: 10_000 })
  assert.equal(statTotals(c, s, 0).levelDiscount, 0.6)
})

test('the best wardrobe for levels stays under the cap, and item totals show what applies', () => {
  const s = fresh()
  const best: Record<string, { id: string; v: number }> = {}
  for (const item of c.items) if (item.stat === 'levelDiscount' && item.value > (best[item.slot]?.v ?? 0)) best[item.slot] = { id: item.id, v: item.value }
  for (const [slot, { id }] of Object.entries(best)) { s.items.owned.push(id); (s.items.equipped as any)[slot] = id }
  const total = itemTotals(c, s).levelDiscount
  assert.ok(total < 0.5, `вещами одними: ${total}`)
  s.items.equipped.top = 'founder_hoodie'
  assert.ok(itemTotals(c, s).levelDiscount <= 0.6)
})

test('a perk stops counting at its until moment', () => {
  const s = fresh()
  s.perks.active.push({ id: 'salary_30_5', until: 1000 })
  assert.equal(statTotals(c, s, 999).salary, 0.3)
  assert.equal(statTotals(c, s, 1000).salary, 0)
})

test('grade discount adds up from items', () => {
  const s = fresh()
  s.items.owned.push('slow_watch', 'friday_jeans')
  s.items.equipped.watch = 'slow_watch'
  s.items.equipped.pants = 'friday_jeans'
  assert.ok(Math.abs(statTotals(c, s, 0).gradeDiscount - 0.15) < 1e-9)
})

test('perk totals sum only active perks', () => {
  const s = fresh()
  s.perks.active.push({ id: 'speed_100_5', until: 10_000 }, { id: 'speed_150_5', until: 10_000 }, { id: 'salary_10_5', until: 5 })
  assert.deepEqual(perkTotals(c, s, 100), { speed: 2.5, salary: 0, levelDiscount: 0, gradeDiscount: 0 })
})
