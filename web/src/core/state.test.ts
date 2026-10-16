import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bundledContent } from './bundled.ts'
import { newGame, nextBuyMode } from './state.ts'
import { decodeState, encodeState } from './serialize.ts'

test('new game', () => {
  const s = newGame(bundledContent, 0, 'ru')
  assert.equal(s.jobs.reboot.level, 1)
  assert.equal(s.jobs.plug_mouse.level, 0)
  assert.equal(Object.keys(s.jobs).length, 12)
  assert.equal(s.money, 0)
  assert.equal(s.settings.haptics, true)
})

test('round trip JSON', () => {
  const s = newGame(bundledContent, 100_000, 'en')
  s.money = 12_345.67
  s.jobs.reboot.startedAt = 42_000
  assert.deepEqual(decodeState(encodeState(s)), s)
  assert.deepEqual(decodeState(JSON.parse(encodeState(s))), s)
})

test('buy mode cycles', () => {
  assert.equal(nextBuyMode('one'), 'ten')
  assert.equal(nextBuyMode('max'), 'one')
})

test('decodeState rejects broken or future saves', () => {
  const valid = JSON.parse(encodeState(newGame(bundledContent, 0, 'ru')))
  assert.equal(decodeState('{not json'), null)
  assert.equal(decodeState(null), null)
  assert.equal(decodeState({ ...valid, schemaVersion: 4 }), null)
  assert.equal(decodeState({ ...valid, money: 'x' }), null)
  assert.equal(decodeState({ ...valid, money: Infinity }), null)
  assert.equal(decodeState({ ...valid, jobs: { reboot: { level: -1, rank: 0, hasManager: false, startedAt: null } } }), null)
  assert.equal(decodeState({ ...valid, settings: { language: 'de', haptics: true } }), null)
})

/** Сейв в формате схемы 1 (этап 1). */
function v1(edit: (s: any) => void = () => {}) {
  const jobs: Record<string, unknown> = {}
  bundledContent.jobs.forEach((j, i) => (jobs[j.id] = { level: i === 0 ? 1 : 0, hasManager: false, startedAt: null }))
  const s = { schemaVersion: 1, money: 10, lifetimeEarnings: 10, jobs, lastActiveAt: 0, settings: { language: 'ru', haptics: true } }
  edit(s)
  return s
}

test('new game has schema 2 fields', () => {
  const s = newGame(bundledContent, 0, 'ru')
  assert.equal(s.schemaVersion, 3)
  assert.equal(s.jobs.reboot.rank, 0)
  assert.deepEqual(s.upgrades, [])
  assert.deepEqual(s.ui, { tutorialDone: false, tutorialStep: 0, sections: ['settings'], hintsSeen: [], ticketCursor: 0 })
})

test('v1 save migrates: rank from reached milestones, empty upgrades', () => {
  const s = decodeState(v1((x) => {
    x.jobs.reboot.level = 137
    x.jobs.plug_mouse.level = 24
    x.jobs.accounting_printer.level = 25
  }), bundledContent)!
  assert.equal(s.schemaVersion, 3)
  assert.equal(s.jobs.reboot.rank, 125)
  assert.equal(s.jobs.plug_mouse.rank, 0)
  assert.equal(s.jobs.accounting_printer.rank, 25)
  assert.deepEqual(s.upgrades, [])
  assert.equal(s.ui.tutorialDone, false)
})

test('v1 save with a manager counts the tutorial as done', () => {
  const s = decodeState(v1((x) => { x.jobs.reboot.level = 60; x.jobs.reboot.hasManager = true }), bundledContent)!
  assert.equal(s.ui.tutorialDone, true)
})

test('v1 save without content cannot be migrated', () => {
  assert.equal(decodeState(v1()), null)
})

test('broken v2 fields are rejected', () => {
  const ok = JSON.parse(encodeState(newGame(bundledContent, 0, 'ru')))
  assert.equal(decodeState({ ...ok, schemaVersion: 4 }), null)
  assert.equal(decodeState({ ...ok, upgrades: [1] }), null)
  assert.equal(decodeState({ ...ok, ui: { ...ok.ui, sections: 'x' } }), null)
  assert.equal(decodeState({ ...ok, jobs: { ...ok.jobs, reboot: { ...ok.jobs.reboot, rank: -1 } } }), null)
})

test('new game has schema 3 fields', () => {
  const s = newGame(bundledContent, 0, 'ru', 7)
  assert.equal(s.stars, 0)
  assert.deepEqual(s.track, { claimed: 0 })
  assert.deepEqual(s.quests, { active: [], rerollAt: 0, seq: 0 })
  assert.deepEqual(s.stats, { collects: 0, hires: 0, upgrades: 0, earned: 0 })
  assert.deepEqual(s.perks, { inventory: {}, active: [] })
  assert.deepEqual(s.items, { owned: [], equipped: {}, seen: [] })
  assert.equal(s.rngSeed, 7)
  assert.equal(s.ui.ticketCursor, 0)
})

test('round trip v3 with quests, perks and items', () => {
  const s = newGame(bundledContent, 0, 'ru', 1)
  s.stars = 12
  s.track.claimed = 10
  s.quests = { active: [{ id: 3, kind: 'level', jobId: 'reboot', target: 25, base: 0 }], rerollAt: 99, seq: 3 }
  s.stats = { collects: 4, hires: 1, upgrades: 0, earned: 1234.5 }
  s.perks = { inventory: { speed_100_5: 2 }, active: [{ id: 'salary_10_5', until: 5000 }] }
  s.items = { owned: ['helpdesk_cap'], equipped: { head: 'helpdesk_cap' }, seen: ['helpdesk_cap'] }
  s.ui.ticketCursor = 17
  assert.deepEqual(decodeState(encodeState(s), bundledContent), s)
})

test('v2 save migrates to v3 with empty stage 2b state', () => {
  const v2 = JSON.parse(encodeState(newGame(bundledContent, 0, 'ru')))
  v2.schemaVersion = 2
  for (const k of ['stars', 'track', 'quests', 'stats', 'perks', 'items', 'rngSeed']) delete v2[k]
  delete v2.ui.ticketCursor
  v2.money = 77
  const s = decodeState(v2, bundledContent)!
  assert.equal(s.schemaVersion, 3)
  assert.equal(s.money, 77)
  assert.equal(s.stars, 0)
  assert.deepEqual(s.perks, { inventory: {}, active: [] })
  assert.deepEqual(s.items, { owned: [], equipped: {}, seen: [] })
  assert.ok(Number.isInteger(s.rngSeed) && s.rngSeed >= 0)
  assert.equal(s.ui.ticketCursor, 0)
})

test('v1 save migrates all the way to v3', () => {
  const s = decodeState(v1((x) => { x.jobs.reboot.level = 137 }), bundledContent)!
  assert.equal(s.schemaVersion, 3)
  assert.equal(s.jobs.reboot.rank, 125)
  assert.equal(s.stars, 0)
})

test('v3 drops unknown perk and item ids when content is given', () => {
  const s = newGame(bundledContent, 0, 'ru', 1)
  s.perks = { inventory: { speed_100_5: 1, gone_perk: 3 }, active: [{ id: 'gone_perk', until: 1 }, { id: 'speed_100_5', until: 1 }] }
  s.items = { owned: ['helpdesk_cap', 'gone_item'], equipped: { head: 'helpdesk_cap', top: 'gone_item' }, seen: ['gone_item'] }
  const d = decodeState(encodeState(s), bundledContent)!
  assert.deepEqual(d.perks, { inventory: { speed_100_5: 1 }, active: [{ id: 'speed_100_5', until: 1 }] })
  assert.deepEqual(d.items, { owned: ['helpdesk_cap'], equipped: { head: 'helpdesk_cap' }, seen: [] })
})

test('v3 with broken counters is rejected', () => {
  const s = JSON.parse(encodeState(newGame(bundledContent, 0, 'ru', 1)))
  assert.equal(decodeState({ ...s, stars: -1 }, bundledContent), null)
  assert.equal(decodeState({ ...s, stats: { ...s.stats, collects: 'x' } }, bundledContent), null)
  assert.equal(decodeState({ ...s, perks: { inventory: { speed_100_5: -2 }, active: [] } }, bundledContent), null)
  assert.equal(decodeState({ ...s, quests: { active: [{ id: 1, kind: 'nope', jobId: null, target: 1, base: 0 }], rerollAt: 0, seq: 1 } }, bundledContent), null)
})
