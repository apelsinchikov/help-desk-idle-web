import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLeaderboardCache, displayName } from './leaderboard.ts'
import type { Leaderboard } from './leaderboard.ts'

const board = (n: number): Leaderboard => ({ top: [{ place: 1, name: `p${n}`, earned: n, me: false }], me: null, refreshedAt: n })

test('a second open within 5 minutes makes no request; after 5 minutes it fetches again', async () => {
  let t = 0
  let calls = 0
  const cache = createLeaderboardCache(async () => board(++calls), () => t)
  assert.equal((await cache.get()).top[0].name, 'p1')
  t = 299_999
  assert.equal((await cache.get()).top[0].name, 'p1')
  assert.equal(calls, 1)
  t = 300_000
  assert.equal((await cache.get()).top[0].name, 'p2')
  assert.equal(calls, 2)
})

test('a failed request is not cached', async () => {
  let fail = true
  let calls = 0
  const cache = createLeaderboardCache(async () => { calls++; if (fail) throw new Error('offline'); return board(1) }, () => 0)
  await assert.rejects(cache.get())
  fail = false
  assert.equal((await cache.get()).top.length, 1)
  assert.equal(calls, 2)
})

test('parallel opens share one request', async () => {
  let calls = 0
  const cache = createLeaderboardCache(async () => board(++calls), () => 0)
  await Promise.all([cache.get(), cache.get()])
  assert.equal(calls, 1)
})

test('display name: first name and the initial of the last name, trimmed to 32', () => {
  assert.equal(displayName({ first_name: 'Евгений', last_name: 'Ассылов' }), 'Евгений А.')
  assert.equal(displayName({ first_name: '  Аня ' }), 'Аня')
  assert.equal(displayName({ first_name: 'x'.repeat(40) }).length, 32)
  assert.equal(displayName(undefined), '')
})
