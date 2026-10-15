import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSaveScheduler } from './saveScheduler.ts'

function setup(upload: () => Promise<void> = async () => {}) {
  const clock = { t: 0 }
  const counts = { local: 0, cloud: 0 }
  const s = createSaveScheduler({
    saveLocal: () => { counts.local++ },
    uploadCloud: async () => { counts.cloud++; await upload() },
    localIntervalMs: 30_000,
    cloudIntervalMs: 30_000,
    now: () => clock.t,
  })
  return { s, clock, counts }
}

test('purchase saves locally right away', () => {
  const { s, counts } = setup()
  s.changed('purchase')
  assert.equal(counts.local, 1)
})

test('ticks save locally only once per interval', () => {
  const { s, clock, counts } = setup()
  for (const t of [1000, 5000, 10_000]) { clock.t = t; s.changed('tick') }
  assert.equal(counts.local, 0)
  clock.t = 30_000
  s.changed('tick')
  assert.equal(counts.local, 1)
})

test('cloud uploads are throttled', () => {
  const { s, clock, counts } = setup()
  clock.t = 30_000
  s.changed('purchase')
  s.changed('purchase')
  assert.equal(counts.cloud, 1)
  clock.t = 60_000
  s.changed('purchase')
  assert.equal(counts.cloud, 2)
})

test('flush saves and uploads regardless of interval', async () => {
  const { s, counts } = setup()
  s.changed('purchase')
  await s.flush()
  assert.equal(counts.local, 2)
  assert.equal(counts.cloud, 2)
})

test('failing upload does not break flush', async () => {
  const { s, counts } = setup(async () => { throw new Error('offline') })
  await assert.doesNotReject(s.flush())
  assert.equal(counts.local, 1)
})
