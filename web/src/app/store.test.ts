import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signal } from '@preact/signals'
import { bundledContent } from '../core/bundled.ts'
import { GameEngine } from '../core/engine.ts'
import { newGame } from '../core/state.ts'
import type { AppLanguage } from '../core/format.ts'
import { createGame } from './store.ts'
import type { CloudStatus } from './store.ts'

test('reset saves locally and uploads right away', async () => {
  const s = newGame(bundledContent, 0, 'ru')
  s.money = 500
  s.lifetimeEarnings = 500
  const engine = new GameEngine(bundledContent, s)
  const calls = { flush: 0, changed: 0 }
  const game = createGame({
    engine,
    scheduler: { changed: () => { calls.changed++ }, flush: async () => { calls.flush++ } },
    cloudStatus: signal<CloudStatus>({ kind: 'disabled' }),
    language: signal<AppLanguage>('ru'),
  })
  await game.reset()
  assert.equal(engine.state.lifetimeEarnings, 0)
  assert.equal(calls.flush, 1, 'сброс сразу уходит в облако, иначе облако вернёт старый прогресс')
})
