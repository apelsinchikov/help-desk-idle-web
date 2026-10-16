import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bundledContent } from './bundled.ts'
import { GameContent } from './content.ts'

/** Контент «без вайпа» (сезон 1): проверяем саму миграцию схем, а не вайп. */
const noWipe = new GameContent(bundledContent.jobs, bundledContent.milestones, { ...bundledContent.config, saveSeason: 1 },
  bundledContent.upgrades, bundledContent.perks, bundledContent.items, bundledContent.chests)
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
  assert.deepEqual(s.ui, { tutorialDone: false, tutorialStep: 0, sections: ['settings'], hintsSeen: [], ticketCursor: 0, wiped: false })
})

test('v1 save migrates: rank from reached milestones, empty upgrades', () => {
  const s = decodeState(v1((x) => {
    x.jobs.reboot.level = 137
    x.jobs.plug_mouse.level = 24
    x.jobs.accounting_printer.level = 25
  }), noWipe)!
  assert.equal(s.schemaVersion, 3)
  assert.equal(s.jobs.reboot.rank, 125)
  assert.equal(s.jobs.plug_mouse.rank, 0)
  assert.equal(s.jobs.accounting_printer.rank, 25)
  assert.deepEqual(s.upgrades, [])
  assert.equal(s.ui.tutorialDone, false)
})

test('v1 save with a manager counts the tutorial as done', () => {
  const s = decodeState(v1((x) => { x.jobs.reboot.level = 60; x.jobs.reboot.hasManager = true }), noWipe)!
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
  const s = decodeState(v1((x) => { x.jobs.reboot.level = 137 }), noWipe)!
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

test('v3 quests are cleaned up on load: at most 3, known jobs, job-bound kinds have a job, ids stay unique', () => {
  const s = newGame(bundledContent, 0, 'ru', 1)
  s.quests = {
    active: [
      { id: 1, kind: 'level', jobId: 'gone_job', target: 25, base: 0 },
      { id: 2, kind: 'promote', jobId: null, target: 25, base: 0 },
      { id: 3, kind: 'earn', jobId: null, target: 100, base: 0 },
      { id: 4, kind: 'collect', jobId: null, target: 30, base: 0 },
      { id: 9, kind: 'unlock', jobId: 'plug_mouse', target: 1, base: 0 },
      { id: 10, kind: 'hire', jobId: null, target: 1, base: 0 },
    ],
    rerollAt: 0,
    seq: 2,
  }
  s.stars = 4
  s.track.claimed = 7
  const d = decodeState(encodeState(s), bundledContent)!
  assert.deepEqual(d.quests.active.map((q) => q.id), [3, 4, 9])
  assert.equal(d.quests.seq, 9, 'новые id — после самого большого из оставшихся')
  assert.equal(d.track.claimed, 4)
})

test('a new game belongs to the current season and gets no compensation', () => {
  const s = newGame(bundledContent, 0, 'ru', 1)
  assert.equal(s.season, bundledContent.config.saveSeason)
  assert.equal(s.ui.wiped, false)
  assert.deepEqual(s.perks.inventory, {})
})

test('a save from an older season is wiped on load: settings and tutorial stay, a 30 min rewind as compensation', () => {
  const old = newGame(bundledContent, 0, 'en', 1) as any
  old.money = 1e9
  old.lifetimeEarnings = 1e12
  old.jobs.reboot = { level: 300, rank: 300, hasManager: true, startedAt: 0 }
  old.stars = 40
  old.items = { owned: ['helpdesk_cap'], equipped: { head: 'helpdesk_cap' }, seen: [] }
  old.ui.tutorialDone = true
  old.ui.hintsSeen = ['managers']
  old.settings.haptics = false
  old.lastActiveAt = 5_000
  delete old.season // сейвы до вайпа поля не имеют
  const d = decodeState(encodeState(old), bundledContent)!
  assert.equal(d.season, bundledContent.config.saveSeason)
  assert.equal(d.money, 0)
  assert.equal(d.lifetimeEarnings, 0)
  assert.equal(d.jobs.reboot.level, 1)
  assert.equal(d.stars, 0)
  assert.deepEqual(d.items.owned, [])
  assert.deepEqual(d.perks.inventory, { rewind_30: 1 })
  assert.deepEqual(d.settings, { language: 'en', haptics: false })
  assert.equal(d.ui.tutorialDone, true)
  assert.deepEqual(d.ui.hintsSeen, ['managers'])
  assert.equal(d.ui.wiped, true)
})

test('a v2 save is wiped too; a current-season save is kept as is', () => {
  const v2 = JSON.parse(encodeState(newGame(bundledContent, 0, 'ru', 1)))
  v2.schemaVersion = 2
  delete v2.season
  v2.money = 500
  assert.equal(decodeState(v2, bundledContent)!.money, 0)
  const now = newGame(bundledContent, 0, 'ru', 1)
  now.money = 500
  assert.equal(decodeState(encodeState(now), bundledContent)!.money, 500)
})
