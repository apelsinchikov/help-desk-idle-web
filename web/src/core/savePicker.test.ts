import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bundledContent } from './bundled.ts'
import { newGame } from './state.ts'
import { pickSave } from './savePicker.ts'

const save = (lifetime: number, at: number) => {
  const s = newGame(bundledContent, at, 'ru')
  s.lifetimeEarnings = lifetime
  return s
}

test('more earnings wins', () => {
  const local = save(100, 50)
  const remote = save(500, 10)
  assert.equal(pickSave(local, remote), remote)
  assert.equal(pickSave(remote, local), remote)
})

test('tie takes newest', () => {
  const older = save(100, 10)
  const newer = save(100, 20)
  assert.equal(pickSave(older, newer), newer)
  assert.equal(pickSave(newer, older), newer)
})

test('missing sides', () => {
  const s = save(1, 1)
  assert.equal(pickSave(null, s), s)
  assert.equal(pickSave(s, null), s)
  assert.equal(pickSave(null, null), null)
})
