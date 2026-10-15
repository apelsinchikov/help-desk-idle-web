import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withTimeout } from './timeout.ts'

test('hanging promise is rejected with timeout', async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 50), /timeout/)
})

test('fast promise passes its value through', async () => {
  assert.equal(await withTimeout(Promise.resolve(7), 50), 7)
})
