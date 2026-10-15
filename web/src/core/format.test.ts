import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatDuration, formatMoney, formatTimer } from './format.ts'

test('numbers', () => {
  assert.equal(formatMoney(186_420, 'ru'), '186 420')
  assert.equal(formatMoney(186_420, 'en'), '186,420')
  assert.equal(formatMoney(1_244_000, 'ru'), '1,24 млн')
  assert.equal(formatMoney(1_244_000, 'en'), '1.24 million')
  assert.equal(formatMoney(3.716e12, 'ru'), '3,72 трлн')
  assert.equal(formatMoney(1e21, 'ru'), '1 aa')
  assert.equal(formatMoney(4.28, 'ru'), '4,28')
  assert.equal(formatMoney(0, 'ru'), '0')
  assert.equal(formatMoney(999_950_000, 'ru'), '1 млрд')
  assert.equal(formatMoney(Infinity, 'ru'), '∞')
})

test('durations', () => {
  assert.equal(formatDuration(702, 'ru'), '11 мин 42 с')
  assert.equal(formatDuration(4800, 'ru'), '1 ч 20 мин')
  assert.equal(formatDuration(702, 'en'), '11 min 42 s')
  assert.equal(formatDuration(1.5, 'ru'), '1,5 с')
  assert.equal(formatDuration(-5, 'ru'), '0 с')
  assert.equal(formatDuration(30 * 86_400, 'ru'), '30 д')
})

test('timer keeps one decimal under a minute', () => {
  assert.equal(formatTimer(0, 'ru'), '0,0 с')
  assert.equal(formatTimer(3, 'en'), '3.0 s')
  assert.equal(formatTimer(0.42, 'ru'), '0,4 с')
  assert.equal(formatTimer(702, 'ru'), '11 мин 42 с')
})
