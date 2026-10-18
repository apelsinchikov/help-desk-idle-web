import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signal } from '@preact/signals'
import { bundledContent } from '../core/bundled.ts'
import { GameEngine } from '../core/engine.ts'
import { newGame } from '../core/state.ts'
import type { AppLanguage } from '../core/format.ts'
import { createGame } from './store.ts'
import type { CloudStatus } from './store.ts'

function setup(edit: (s: ReturnType<typeof newGame>) => void = () => {}, clock = { t: 0 }, ads?: { show(): Promise<'done' | 'skipped' | 'unavailable'> } | null) {
  const s = newGame(bundledContent, 0, 'ru')
  edit(s)
  const engine = new GameEngine(bundledContent, s, () => clock.t)
  const calls = { flush: 0, changed: [] as string[] }
  const game = createGame({
    engine,
    scheduler: { changed: (k) => { calls.changed.push(k) }, flush: async () => { calls.flush++ } },
    cloudStatus: signal<CloudStatus>({ kind: 'disabled' }),
    language: signal<AppLanguage>('ru'),
    now: () => clock.t,
    ads,
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
  assert.deepEqual(game.messages.value, [{ kind: 'toast', text: { key: 'ach.job', args: ['job.reboot.title', 25, { rewards: [{ effect: 'effect.speed', value: 2 }] }] } }])
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
  game.pushToast({ key: 'ach.all', args: [25, { rewards: [{ effect: 'effect.speed', value: 2 }] }] })
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
    game.pushToast({ key: 'ach.all', args: [25, { rewards: [{ effect: 'effect.speed', value: 2 }] }] })
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

test('energy: a watched ad fills a can, a skipped one does not', async () => {
  let result: 'done' | 'skipped' = 'done'
  let shows = 0
  const { engine, game } = setup(() => {}, { t: 0 }, { show: async () => { shows++; return result } })
  await game.watchAd()
  assert.equal(engine.stats().speed, 0.3)
  result = 'skipped'
  await game.watchAd()
  assert.equal(shows, 2)
  assert.equal(engine.state.perks.active.find((a) => a.id === 'energy_drink')!.until, 5 * 60_000, 'пропущенная реклама банку не даёт')
})

test('energy: with all five cans full no ad is shown, a joke pops up instead', async () => {
  let shows = 0
  const { game } = setup(() => {}, { t: 0 }, { show: async () => { shows++; return 'done' } })
  for (let i = 0; i < 5; i++) await game.watchAd()
  assert.equal(shows, 5)
  await game.watchAd()
  assert.equal(shows, 5)
  assert.notEqual(game.energyJoke.value, null)
})

test('energy: no ad network — a toast, no boost', async () => {
  const { engine, game } = setup(() => {}, { t: 0 }, null)
  await game.watchAd()
  assert.equal(engine.stats().speed, 0)
  assert.deepEqual(game.messages.value.at(-1), { kind: 'toast', text: { key: 'energy.noAds', args: [] } })
})

test('reorganization: coins in, a report, saved at once, back to the jobs screen', async () => {
  const { lifetimeFor } = await import('../core/prestige.ts')
  const { engine, game, calls } = setup((s) => { s.lifetimeEarnings = lifetimeFor(bundledContent, 12) * 1.001; s.money = 1e9 })
  game.navigate('reorg')
  await game.reorganize()
  assert.equal(engine.state.coins.balance, 12)
  assert.deepEqual(game.reorgReport.value, { coins: 12 })
  assert.equal(game.route.value, 'jobs')
  assert.equal(calls.flush, 1)
  assert.equal(engine.state.money, 0)
})

test('welcome back: x2 for an ad credits the offline earnings once more', async () => {
  const clock = { t: 0 }
  const { engine, game } = setup((s) => { s.jobs.reboot = { level: 10, rank: 0, hasManager: true, startedAt: 0 } }, clock, { show: async () => 'done' })
  clock.t = 3_600_000
  game.onVisible()
  const report = game.offlineReport.value!
  const before = engine.state.money
  await game.doubleOffline()
  assert.equal(engine.state.money, before + report.earned)
  assert.equal(game.offlineDoubled.value, true)
  await game.doubleOffline()
  assert.equal(engine.state.money, before + report.earned, 'второй раз не удваивается')
  game.closeOffline()
  assert.equal(game.offlineReport.value, null)
  game.stopTicking()
})

test('welcome back: Buy opens TechCoin upgrades', () => {
  const { game } = setup()
  game.offlineReport.value = { elapsed: 30_000, earned: 5, counted: 7200, readyJobs: 0 }
  game.openCoinUpgrades()
  assert.equal(game.offlineReport.value, null)
  assert.equal(game.coinTab.value, 'coins')
  assert.equal(game.route.value, 'upgrades')
})
