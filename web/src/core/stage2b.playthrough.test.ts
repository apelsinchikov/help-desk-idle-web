// Сквозной сценарий этапа 2b: задания → звёзды → награды трека → перк из рюкзака действует, вещь надета.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signal } from '@preact/signals'
import { bundledContent as c } from './bundled.ts'
import { GameEngine } from './engine.ts'
import { newGame } from './state.ts'
import { statTotals } from './modifiers.ts'
import { decodeState, encodeState } from './serialize.ts'
import { createGame } from '../app/store.ts'
import type { CloudStatus } from '../app/store.ts'
import type { AppLanguage } from './format.ts'

test('a simple bot earns stars from quests, gets a perk at 5 and an item at 10', () => {
  const clock = { t: 0 }
  const s = newGame(c, 0, 'ru', 123)
  s.ui.tutorialDone = true
  const engine = new GameEngine(c, s, () => clock.t)
  const game = createGame({
    engine,
    scheduler: { changed: () => {}, flush: async () => {} },
    cloudStatus: signal<CloudStatus>({ kind: 'disabled' }),
    language: signal<AppLanguage>('ru'),
    now: () => clock.t,
  })
  let gotPerkAt5 = false
  for (let i = 0; i < 6 * 3600 && engine.state.stars < 10; i++) {
    clock.t += 1000
    game.act('tap', () => {
      engine.advance(clock.t)
      for (const job of c.jobs) {
        if (engine.status(job.id).kind === 'ready') engine.tap(job.id)
        if (engine.canUnlock(job.id)) engine.unlock(job.id)
        if (engine.canHireManager(job.id)) engine.hireManager(job.id)
        if (engine.atCap(job.id)) engine.promote(job.id)
      }
      for (const u of c.upgrades) if (engine.canBuyUpgrade(u.id)) engine.buyUpgrade(u.id)
      const cheapest = c.jobs.filter((j) => engine.level(j.id) > 0 && !engine.atCap(j.id))
        .sort((a, b) => engine.quote(a.id, 'one').cost - engine.quote(b.id, 'one').cost)[0]
      if (cheapest) engine.buy(cheapest.id, 'one')
    })
    if (engine.state.stars >= 5 && Object.keys(engine.state.perks.inventory).length > 0) gotPerkAt5 = true
  }
  assert.ok(engine.state.stars >= 10, `звёзд: ${engine.state.stars}`)
  assert.ok(gotPerkAt5, 'на 5 ⭐ в рюкзаке перк')
  assert.equal(engine.state.items.equipped.head, 'helpdesk_cap', 'на 10 ⭐ кепка надета')
  assert.ok(game.messages.value.some((m) => m.kind === 'toast' && m.text.key === 'toast.item'))

  const perkId = Object.keys(engine.state.perks.inventory).find((id) => c.perk(id)!.kind !== 'rewind')
  if (perkId) {
    game.activatePerk(perkId)
    const perk = c.perk(perkId)!
    assert.ok(statTotals(c, engine.state, clock.t)[perk.kind as 'speed'] >= perk.value)
  }
  assert.deepEqual(decodeState(encodeState(engine.state), c), engine.state)
})
