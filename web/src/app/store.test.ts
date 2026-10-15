import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signal } from '@preact/signals'
import { bundledContent } from '../core/bundled.ts'
import { GameEngine } from '../core/engine.ts'
import { newGame } from '../core/state.ts'
import type { AppLanguage } from '../core/format.ts'
import { createGame } from './store.ts'
import type { CloudStatus } from './store.ts'

function setup(edit: (s: ReturnType<typeof newGame>) => void = () => {}) {
  const s = newGame(bundledContent, 0, 'ru')
  edit(s)
  const engine = new GameEngine(bundledContent, s)
  const calls = { flush: 0, changed: [] as string[] }
  const game = createGame({
    engine,
    scheduler: { changed: (k) => { calls.changed.push(k) }, flush: async () => { calls.flush++ } },
    cloudStatus: signal<CloudStatus>({ kind: 'disabled' }),
    language: signal<AppLanguage>('ru'),
  })
  return { engine, game, calls }
}

test('reset saves locally and uploads right away', async () => {
  const { engine, game, calls } = setup((s) => { s.money = 500; s.lifetimeEarnings = 500 })
  await game.reset()
  assert.equal(engine.state.lifetimeEarnings, 0)
  assert.equal(calls.flush, 1, 'сброс сразу уходит в облако, иначе облако вернёт старый прогресс')
})

test('promotion queues an achievement toast and saves at once', () => {
  const { engine, game, calls } = setup((s) => { s.jobs.reboot.level = 25; s.money = 1e9; s.lifetimeEarnings = 1e9 })
  game.promote('reboot')
  assert.equal(engine.rank('reboot'), 25)
  assert.deepEqual(game.toasts.value, [{ key: 'ach.job', args: ['job.reboot.title', 25, 'effect.speed', 2] }])
  assert.deepEqual(calls.changed, ['purchase'])
  assert.ok(engine.state.ui.sections.includes('achievements'), 'раздел открылся после первого повышения')
  game.dismissToast()
  assert.deepEqual(game.toasts.value, [])
})

test('section hint is marked once', () => {
  const { engine, game } = setup()
  game.markHintSeen('managers')
  game.markHintSeen('managers')
  assert.deepEqual(engine.state.ui.hintsSeen, ['managers'])
})

test('tutorial ack moves the step on', () => {
  const { engine, game } = setup((s) => { s.lifetimeEarnings = 50; s.jobs.reboot.level = 4 })
  game.act('tap', () => {})
  assert.equal(engine.state.ui.tutorialStep, 3)
  game.ackTutorial()
  assert.equal(engine.state.ui.tutorialStep, 4)
})
