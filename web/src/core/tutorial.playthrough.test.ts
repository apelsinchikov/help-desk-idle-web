import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeClock, makeEngine } from './testkit.ts'
import { tutorialAck, tutorialAdvance, tutorialView } from './progress.ts'
import type { BuyMode } from './state.ts'

/**
 * Новый игрок проходит обучение: когда подсветка есть — делает только подсвеченное (остальное заблокировано),
 * и это действие обязано сработать; когда подсветки нет — играет как обычно (тапает, покупает, гуляет по меню).
 */
function playthrough(buyMode: BuyMode, wanderMenu: boolean) {
  const c = makeClock()
  const e = makeEngine(c)
  let route = 'jobs'
  for (let i = 0; i < 6 * 3600 * 10 && !e.state.ui.tutorialDone; i++) {
    c.t += 100
    e.advance(c.t)
    tutorialAdvance(e, route, buyMode)
    const v = tutorialView(e, route, buyMode)
    if (v) {
      const t = v.target
      let ok = true
      if (v.needsAck) tutorialAck(e, route, buyMode)
      else if (t.kind === 'job-icon') { const before = e.state.lifetimeEarnings; const st = e.status(t.jobId).kind; e.tap(t.jobId); ok = st === 'idle' ? e.state.jobs[t.jobId].startedAt !== null : e.state.lifetimeEarnings > before }
      else if (t.kind === 'job-panel') ok = e.atCap(t.jobId) ? e.promote(t.jobId) !== null : e.buy(t.jobId, buyMode)
      else if (t.kind === 'job-unlock') ok = e.unlock(t.jobId)
      else if (t.kind === 'menu') route = 'menu'
      else if (t.kind === 'menu-managers') route = 'managers'
      else if (t.kind === 'manager-hire') ok = e.hireManager(t.jobId)
      assert.ok(ok, `застрял на шаге ${v.step} (${t.kind}) на ${(c.t / 1000).toFixed(0)} с`)
      tutorialAdvance(e, route, buyMode)
      continue
    }
    // подсветки нет — обычная игра
    route = wanderMenu && i % 600 === 0 ? 'menu' : 'jobs'
    for (const j of e.content.jobs) {
      const st = e.status(j.id).kind
      if (st === 'idle' || st === 'ready') e.tap(j.id)
      if (e.canUnlock(j.id)) e.unlock(j.id)
      if (e.atCap(j.id)) e.promote(j.id)
      else e.buy(j.id, 'one')
    }
  }
  return e
}

test('a new player finishes the tutorial without getting stuck', () => {
  assert.equal(playthrough('one', false).state.ui.tutorialDone, true)
})

test('switching buy mode to x100 does not lock the tutorial', () => {
  assert.equal(playthrough('hundred', false).state.ui.tutorialDone, true)
})

test('visiting the menu early does not skip or lock the manager steps', () => {
  assert.equal(playthrough('one', true).state.ui.tutorialDone, true)
})
