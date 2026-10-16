import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createClock } from './clock.ts'

test('without a server answer the clock is the device clock', () => {
  let device = 1000
  const clock = createClock(() => device)
  assert.equal(clock.now(), 1000)
  device = 5000
  assert.equal(clock.now(), 5000)
})

test('server time sets the offset using the middle of the round trip', () => {
  let device = 10_000
  const clock = createClock(() => device)
  // устройство ушло на час вперёд: сервер говорит 7 000 мс, запрос шёл с 10 000 до 10 400 (середина 10 200)
  assert.equal(clock.sync(7_000, 10_000, 10_400), true)
  device = 10_400
  assert.equal(clock.now(), 7_200)
})

test('a slow or broken answer is ignored', () => {
  const clock = createClock(() => 0)
  assert.equal(clock.sync(5_000, 0, 20_000), false, 'ответ дольше 10 с — неточный')
  assert.equal(clock.sync(Number.NaN, 0, 100), false)
  assert.equal(clock.sync(5_000, 100, 50), false)
  assert.equal(clock.now(), 0)
})
