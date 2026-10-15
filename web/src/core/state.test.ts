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
  assert.equal(decodeState({ ...valid, schemaVersion: 3 }), null)
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
  assert.equal(s.schemaVersion, 2)
  assert.equal(s.jobs.reboot.rank, 0)
  assert.deepEqual(s.upgrades, [])
  assert.deepEqual(s.ui, { tutorialDone: false, tutorialStep: 0, sections: ['settings'], hintsSeen: [] })
})

test('v1 save migrates: rank from reached milestones, empty upgrades', () => {
  const s = decodeState(v1((x) => {
    x.jobs.reboot.level = 137
    x.jobs.plug_mouse.level = 24
    x.jobs.accounting_printer.level = 25
  }), bundledContent)!
  assert.equal(s.schemaVersion, 2)
  assert.equal(s.jobs.reboot.rank, 100)
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
  assert.equal(decodeState({ ...ok, schemaVersion: 3 }), null)
  assert.equal(decodeState({ ...ok, upgrades: [1] }), null)
  assert.equal(decodeState({ ...ok, ui: { ...ok.ui, sections: 'x' } }), null)
  assert.equal(decodeState({ ...ok, jobs: { ...ok.jobs, reboot: { ...ok.jobs.reboot, rank: -1 } } }), null)
})
