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
  assert.equal(decodeState({ ...valid, schemaVersion: 2 }), null)
  assert.equal(decodeState({ ...valid, money: 'x' }), null)
  assert.equal(decodeState({ ...valid, money: Infinity }), null)
  assert.equal(decodeState({ ...valid, jobs: { reboot: { level: -1, hasManager: false, startedAt: null } } }), null)
  assert.equal(decodeState({ ...valid, settings: { language: 'de', haptics: true } }), null)
})
