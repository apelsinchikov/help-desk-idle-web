import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bundledContent as c } from './bundled.ts'
import { makeClock, makeEngine } from './testkit.ts'
import { claimTrack, itemStarSchedule, perkTier, rewardStars } from './track.ts'
import { decodeState, encodeState } from './serialize.ts'
import { GameEngine } from './engine.ts'

const engineWith = (stars: number, claimed = 0, seed = 42) =>
  makeEngine(makeClock(), (s) => { s.stars = stars; s.track.claimed = claimed; s.rngSeed = seed })

test('perk tiers follow stars', () => {
  assert.equal(perkTier(c, 0).fromStars, 0)
  assert.equal(perkTier(c, 49).fromStars, 0)
  assert.equal(perkTier(c, 50).fromStars, 50)
  assert.equal(perkTier(c, 999).fromStars, 150)
})

test('5 stars: one weak perk into the backpack', () => {
  const e = engineWith(5)
  const rewards = claimTrack(e)
  assert.equal(rewards.length, 1)
  assert.equal(rewards[0].kind, 'perk')
  const perk = c.perk((rewards[0] as any).perkId)!
  assert.ok(perk.kind === 'rewind' ? perk.minutes === 10 : perk.minutes === 5, perk.id)
  if (perk.kind === 'speed') assert.equal(perk.value, 1)
  assert.equal(Object.values(e.state.perks.inventory).reduce((a, b) => a + b, 0), 1)
  assert.equal(e.state.track.claimed, 5)
})

test('0 → 20 stars gives perk, item, perk, item in order; claiming again gives nothing', () => {
  const e = engineWith(20)
  assert.deepEqual(claimTrack(e).map((r) => r.kind), ['perk', 'item', 'perk', 'item'])
  assert.deepEqual(e.state.items.owned, ['helpdesk_cap', 'sprint_pants'])
  assert.deepEqual(e.state.items.equipped, {}, 'вещи сами не надеваются')
  assert.deepEqual(claimTrack(e), [])
})

test('50 stars: the next item plus the longest open rewind', () => {
  const e = engineWith(50, 45)
  assert.deepEqual(claimTrack(e), [{ kind: 'item', itemId: 'helpdesk_cap' }, { kind: 'perk', perkId: 'rewind_15' }])
})

test('rewards do not change after a reload: the seed lives in the save', () => {
  const a = engineWith(40)
  const saved = encodeState(a.state)
  const first = claimTrack(a)
  const b = new GameEngine(c, decodeState(saved, c)!, () => 0)
  assert.deepEqual(claimTrack(b), first)
})

test('after all 28 items the tens give a perk instead', () => {
  const e = engineWith(290, 280)
  for (const item of c.items) e.state.items.owned.push(item.id)
  assert.deepEqual(claimTrack(e).map((r) => r.kind), ['perk', 'perk'])
})

test('every perk the track hands out exists in perks.json', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const e = engineWith(400, 0, seed)
    for (const r of claimTrack(e)) if (r.kind === 'perk') assert.ok(c.perk(r.perkId), r.perkId)
  }
})

test('item stars grow with rarity: common every 10, rare 20, epic 40, legendary 80', () => {
  const schedule = itemStarSchedule(c)
  assert.equal(schedule.length, 28)
  assert.deepEqual(schedule.slice(0, 9), [10, 20, 30, 40, 50, 60, 70, 90, 110])
  assert.equal(schedule[13], 210)
  assert.equal(schedule[14], 250)
  assert.equal(schedule[21], 570)
  assert.equal(schedule[27], 1050)
})

test('perks every 10 tickets on the fives; a ten without an item gives nothing', () => {
  const e = engineWith(80, 75)
  for (const item of c.items.slice(0, 7)) e.state.items.owned.push(item.id)
  assert.deepEqual(claimTrack(e), [], '80 — не вещь и не перк')
  const e2 = engineWith(85, 80)
  assert.deepEqual(claimTrack(e2).map((r) => r.kind), ['perk'])
  const e3 = engineWith(90, 85)
  for (const item of c.items.slice(0, 7)) e3.state.items.owned.push(item.id)
  assert.deepEqual(claimTrack(e3), [{ kind: 'item', itemId: 'notabug_glasses' }])
})

test('reward stars: what the track hands out next and what it gave last', () => {
  assert.deepEqual(rewardStars(c, 1, 5), [5, 10, 15, 20, 25])
  assert.deepEqual(rewardStars(c, 71, 4), [75, 85, 90, 95], '80 пустая: вещи уже раз в 20')
  assert.deepEqual(rewardStars(c, 100, 3, -1), [90, 95, 100], '100 — перемотка')
  assert.deepEqual(rewardStars(c, 3, 3, -1), [])
})
