import { test } from 'node:test'
import assert from 'node:assert/strict'
import { achievementText, promotionLabelKey } from './achievements.ts'

test('regular job milestone', () => {
  assert.deepEqual(achievementText({ jobId: 'reboot', level: 25, effect: 'speed', value: 2 }, 0), {
    key: 'ach.job', args: ['job.reboot.title', 25, 'effect.speed', 2],
  })
})

test('accounting jobs speak with Lyudmila', () => {
  assert.deepEqual(achievementText({ jobId: 'accounting_printer', level: 50, effect: 'speed', value: 2 }, 2), { key: 'ach.lyudmila.50', args: [] })
  assert.deepEqual(achievementText({ jobId: 'accounting_1c', level: 400, effect: 'speed', value: 2 }, 6), { key: 'ach.lyudmila.400', args: [] })
  assert.equal(achievementText({ jobId: 'accounting_1c', level: 500, effect: 'profit', value: 4 }, 6).key, 'ach.job', 'нет шутки — обычный текст')
})

test('global milestone', () => {
  assert.deepEqual(achievementText({ jobId: null, level: 50, effect: 'speed', value: 2 }, -1), {
    key: 'ach.all', args: [50, 'effect.speed', 2],
  })
})

test('promotion labels cycle through 8 phrases', () => {
  assert.equal(promotionLabelKey(0), 'promo.1')
  assert.equal(promotionLabelKey(7), 'promo.8')
  assert.equal(promotionLabelKey(8), 'promo.1')
})
