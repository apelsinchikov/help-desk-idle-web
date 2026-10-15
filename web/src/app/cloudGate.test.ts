import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bundledContent } from '../core/bundled.ts'
import { newGame } from '../core/state.ts'
import type { GameState } from '../core/state.ts'
import { createCloudGate } from './cloudGate.ts'
import type { RemoteSave } from './cloudGate.ts'

const save = (lifetime: number) => {
  const s = newGame(bundledContent, 0, 'ru')
  s.lifetimeEarnings = lifetime
  return s
}

function setup(remote: () => Promise<RemoteSave>, local: GameState = save(0)) {
  const log = { downloads: 0, uploads: [] as number[] }
  let current = local
  const gate = createCloudGate({
    cloud: {
      download: async () => { log.downloads++; return remote() },
      upload: async (s) => { log.uploads.push(s.lifetimeEarnings) },
    },
    current: () => current,
    adopt: (s) => { current = s },
  })
  return { gate, log, current: () => current }
}

test('upload before reconcile downloads first and keeps the better cloud save', async () => {
  const { gate, log, current } = setup(async () => ({ kind: 'ok', state: save(500) }))
  await gate.upload()
  assert.equal(current().lifetimeEarnings, 500, 'облачный прогресс принят')
  assert.deepEqual(log.uploads, [500], 'новая пустая игра не затёрла облако')
})

test('unreadable or future cloud save is never overwritten', async () => {
  const { gate, log } = setup(async () => ({ kind: 'unreadable' }))
  await assert.rejects(gate.reconcile())
  await assert.rejects(gate.upload())
  assert.deepEqual(log.uploads, [])
})

test('failed download blocks upload until a later download succeeds', async () => {
  let online = false
  const { gate, log } = setup(async () => {
    if (!online) throw new Error('offline')
    return { kind: 'none' }
  }, save(7))
  await assert.rejects(gate.upload())
  assert.deepEqual(log.uploads, [])
  online = true
  await gate.upload()
  assert.deepEqual(log.uploads, [7])
})

test('concurrent reconcile downloads once', async () => {
  const { gate, log } = setup(async () => ({ kind: 'none' }))
  await Promise.all([gate.reconcile(), gate.reconcile(), gate.upload()])
  assert.equal(log.downloads, 1)
})

test('force upload after reset is allowed once reconciled', async () => {
  const { gate, log } = setup(async () => ({ kind: 'ok', state: save(100) }), save(300))
  await gate.reconcile()
  await gate.upload()
  assert.deepEqual(log.uploads, [300])
})
