import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeClock, makeEngine } from './testkit.ts'
import { buyableCounts, refreshSections, sectionLock, tutorialAck, tutorialAdvance, tutorialView } from './progress.ts'

test('fresh game: the job runs by itself, the tutorial first asks to collect', () => {
  const c = makeClock()
  const e = makeEngine(c)
  tutorialAdvance(e, 'jobs')
  assert.equal(tutorialView(e, 'jobs'), null, 'пока работа идёт — подсказки нет')
  c.t += 600
  const v = tutorialView(e, 'jobs')!
  assert.equal(v.textKey, 'tutorial.1')
  assert.deepEqual(v.target, { kind: 'job-icon', jobId: 'reboot' })
})

test('tutorial waits for the job to be ready, then asks to collect', () => {
  const c = makeClock()
  const e = makeEngine(c)
  tutorialAdvance(e, 'jobs')
  assert.equal(e.state.ui.tutorialStep, 1)
  assert.equal(tutorialView(e, 'jobs'), null, 'пока работа идёт — подсказки нет')
  c.t += 600
  assert.equal(tutorialView(e, 'jobs')!.textKey, 'tutorial.1')
})

test('buy-mode step needs an acknowledgement', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => { s.lifetimeEarnings = 50; s.jobs.reboot.level = 4; s.money = 0 })
  tutorialAdvance(e, 'jobs')
  const v = tutorialView(e, 'jobs')!
  assert.equal(v.step, 3)
  assert.equal(v.needsAck, true)
  assert.deepEqual(v.target, { kind: 'buy-mode' })
  tutorialAck(e, 'jobs')
  assert.equal(e.state.ui.tutorialStep, 4)
  assert.equal(tutorialView(e, 'jobs'), null, 'работа 2 ещё не по карману')
})

test('an advanced save skips every step that is already done', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => {
    s.lifetimeEarnings = 1e5
    s.jobs.reboot = { level: 30, rank: 25, hasManager: false, startedAt: null }
    s.jobs.plug_mouse.level = 5
    s.money = 0
  })
  tutorialAdvance(e, 'jobs')
  assert.equal(e.state.ui.tutorialStep, 6)
  assert.equal(tutorialView(e, 'jobs'), null, 'менеджер ещё недоступен')
})

test('manager steps lead through menu, managers, hire, then finish', () => {
  const c = makeClock()
  const e = makeEngine(c, (s) => {
    s.lifetimeEarnings = 1e5
    s.jobs.reboot = { level: 100, rank: 50, hasManager: false, startedAt: null }
    s.jobs.plug_mouse.level = 1
    s.money = 5000
  })
  tutorialAdvance(e, 'jobs')
  assert.deepEqual(tutorialView(e, 'jobs')!.target, { kind: 'menu' })
  tutorialAdvance(e, 'menu')
  assert.deepEqual(tutorialView(e, 'menu')!.target, { kind: 'menu-managers' })
  tutorialAdvance(e, 'managers')
  assert.deepEqual(tutorialView(e, 'managers')!.target, { kind: 'manager-hire', jobId: 'reboot' })
  e.hireManager('reboot')
  tutorialAdvance(e, 'managers')
  assert.equal(tutorialView(e, 'managers')!.needsAck, true)
  tutorialAck(e, 'managers')
  assert.equal(e.state.ui.tutorialDone, true)
  assert.ok(e.state.ui.hintsSeen.includes('managers'), 'подсказка раздела не повторяет итог обучения')
  assert.equal(tutorialView(e, 'jobs'), null)
})

test('sections open by progress and only once', () => {
  const c = makeClock()
  const e = makeEngine(c)
  assert.deepEqual(refreshSections(e), [])
  e.state.jobs.reboot.level = 51
  e.state.jobs.reboot.rank = 50
  e.state.lifetimeEarnings = 25_000_000
  assert.deepEqual(refreshSections(e).sort(), ['achievements', 'managers', 'upgrades'])
  assert.deepEqual(refreshSections(e), [])
  assert.deepEqual([...e.state.ui.sections].sort(), ['achievements', 'managers', 'settings', 'upgrades'])
})

test('managers section is open for a player who already has a manager', () => {
  const e = makeEngine(makeClock(), (s) => { s.jobs.reboot = { level: 30, rank: 25, hasManager: true, startedAt: 0 } })
  assert.ok(refreshSections(e).includes('managers'))
})

test('a locked section says what opens it', () => {
  const e = makeEngine(makeClock(), (s) => { s.jobs.reboot.level = 30; s.jobs.reboot.rank = 25; s.lifetimeEarnings = 1000 })
  assert.equal(sectionLock(e, 'managers'), null, 'менеджер первых работ — с первого повышения')
  assert.equal(sectionLock(e, 'achievements'), null)
  assert.deepEqual(sectionLock(e, 'upgrades'), { kind: 'earn', need: 25_000_000, have: 1000 })
  const fresh = makeEngine(makeClock())
  assert.deepEqual(sectionLock(fresh, 'achievements'), { kind: 'rank', need: 25, best: 1 })
  assert.deepEqual(sectionLock(fresh, 'managers'), { kind: 'rank', need: 25, best: 1 })
})

test('menu alert counts managers and upgrades the player can buy now', () => {
  const e = makeEngine(makeClock(), (s) => { s.jobs.reboot.level = 51; s.jobs.reboot.rank = 50; s.money = 10 })
  assert.deepEqual(buyableCounts(e), { managers: 0, upgrades: 0, perks: 0, items: 0 })
  e.state.money = 30_000_000
  assert.deepEqual(buyableCounts(e), { managers: 1, upgrades: 1, perks: 0, items: 0 })
  e.state.upgrades.push('reboot_x3')
  assert.deepEqual(buyableCounts(e), { managers: 1, upgrades: 0, perks: 0, items: 0 })
})

test('backpack also opens with the first item', () => {
  const e = makeEngine(makeClock())
  e.grantItem('helpdesk_cap')
  assert.equal(sectionLock(e, 'backpack'), null)
})

test('backpack opens with the first perk; until then it says 5 stars', () => {
  const e = makeEngine(makeClock())
  assert.deepEqual(sectionLock(e, 'backpack'), { kind: 'stars', need: 5, have: 0 })
  e.state.perks.inventory.speed_100_5 = 1
  assert.equal(sectionLock(e, 'backpack'), null)
  assert.ok(refreshSections(e).includes('backpack'))
})

test('menu dot also lights up when the backpack has perks to switch on', () => {
  const e = makeEngine(makeClock())
  assert.equal(buyableCounts(e).perks, 0)
  e.state.perks.inventory.rewind_10 = 2
  assert.equal(buyableCounts(e).perks, 2)
})

test('wardrobe opens with the first item; until then it says 10 stars', () => {
  const e = makeEngine(makeClock())
  assert.deepEqual(sectionLock(e, 'wardrobe'), { kind: 'stars', need: 10, have: 0 })
  e.grantItem('helpdesk_cap')
  assert.equal(sectionLock(e, 'wardrobe'), null)
  assert.ok(refreshSections(e).includes('wardrobe'))
})

test('new items not yet looked at count for the menu dot', () => {
  const e = makeEngine(makeClock())
  e.grantItem('helpdesk_cap')
  e.grantItem('look_glasses')
  assert.equal(buyableCounts(e).items, 2)
  e.state.items.seen.push('helpdesk_cap')
  assert.equal(buyableCounts(e).items, 1)
})

test('quests section opens with the finished tutorial', () => {
  const e = makeEngine(makeClock())
  assert.deepEqual(sectionLock(e, 'quests'), { kind: 'tutorial' })
  e.state.ui.tutorialDone = true
  assert.equal(sectionLock(e, 'quests'), null)
})

test('lock progress shows the best job level, not the rank: level 25 reached but not promoted yet', () => {
  const e = makeEngine(makeClock(), (s) => { s.jobs.reboot.level = 25; s.jobs.reboot.rank = 0 })
  assert.deepEqual(sectionLock(e, 'managers'), { kind: 'rank', need: 25, best: 25 })
})
