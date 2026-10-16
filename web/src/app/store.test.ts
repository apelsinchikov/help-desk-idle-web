import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signal } from '@preact/signals'
import { bundledContent } from '../core/bundled.ts'
import { GameEngine } from '../core/engine.ts'
import { newGame } from '../core/state.ts'
import type { AppLanguage } from '../core/format.ts'
import { createGame } from './store.ts'
import type { CloudStatus } from './store.ts'

function setup(edit: (s: ReturnType<typeof newGame>) => void = () => {}, clock = { t: 0 }) {
  const s = newGame(bundledContent, 0, 'ru')
  edit(s)
  const engine = new GameEngine(bundledContent, s)
  const calls = { flush: 0, changed: [] as string[] }
  const game = createGame({
    engine,
    scheduler: { changed: (k) => { calls.changed.push(k) }, flush: async () => { calls.flush++ } },
    cloudStatus: signal<CloudStatus>({ kind: 'disabled' }),
    language: signal<AppLanguage>('ru'),
    now: () => clock.t,
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
  assert.deepEqual(game.messages.value, [{ kind: 'toast', text: { key: 'ach.job', args: ['job.reboot.title', 25, 'effect.speed', 2] } }])
  assert.deepEqual(calls.changed, ['purchase'])
  assert.ok(engine.state.ui.sections.includes('achievements'), 'раздел открылся после первого повышения')
  game.dismissMessage()
  assert.deepEqual(game.messages.value, [])
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

test('support tickets come every 3 minutes after the tutorial, toasts go first', () => {
  const clock = { t: 0 }
  const { game } = setup((s) => { s.ui.tutorialDone = true }, clock)
  clock.t = 179_000
  game.checkTicket()
  assert.deepEqual(game.messages.value, [])
  clock.t = 180_000
  game.pushToast({ key: 'ach.all', args: [25, 'effect.speed', 2] })
  game.checkTicket()
  assert.equal(game.messages.value.length, 1, 'пока висит тост, заявка не приходит')
  game.dismissMessage()
  clock.t = 360_000
  game.checkTicket()
  assert.deepEqual(game.messages.value, [{ kind: 'ticket', index: 0 }])
  game.dismissMessage()
  clock.t = 400_000
  game.checkTicket()
  assert.deepEqual(game.messages.value, [], '3 минуты считаются от закрытия последнего сообщения')
})

test('frequent toasts do not starve support tickets', () => {
  const clock = { t: 0 }
  const { game } = setup((s) => { s.ui.tutorialDone = true }, clock)
  for (let t = 100_000; t <= 200_000; t += 100_000) {
    clock.t = t
    game.pushToast({ key: 'ach.all', args: [25, 'effect.speed', 2] })
    clock.t = t + 5_000
    game.dismissMessage()
  }
  clock.t = 206_000
  game.checkTicket()
  assert.deepEqual(game.messages.value, [{ kind: 'ticket', index: 0 }], '3 минуты считаются от прошлой заявки, а не от любого тоста')
})

test('buying one upgrade buys only that one, even when two are affordable', () => {
  const [a, b] = bundledContent.upgrades
  const { engine, game } = setup((s) => { s.money = a.cost + b.cost; s.lifetimeEarnings = s.money })
  game.buyUpgrade(a.id)
  assert.deepEqual(engine.state.upgrades, [a.id])
  assert.equal(engine.state.money, b.cost)
  assert.equal(engine.canBuyUpgrade(b.id), true, 'на второе ещё хватает — его кнопка активна')
})

test('when money covers only one upgrade, the other button goes grey but nothing else is bought', () => {
  const [a, b] = bundledContent.upgrades
  const { engine, game } = setup((s) => { s.money = b.cost; s.lifetimeEarnings = s.money })
  assert.equal(engine.canBuyUpgrade(a.id), true)
  assert.equal(engine.canBuyUpgrade(b.id), true)
  game.buyUpgrade(a.id)
  assert.deepEqual(engine.state.upgrades, [a.id])
  assert.equal(engine.canBuyUpgrade(b.id), false, 'денег не осталось — кнопка гаснет, покупки нет')
})
