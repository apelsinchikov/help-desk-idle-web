import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bundledContent as c } from './bundled.ts'
import { makeClock, makeEngine } from './testkit.ts'
import { beautify, completeQuests, fillQuests, questProgress, rerollQuest } from './quests.ts'
import type { Quest } from './state.ts'

const afterTutorial = (edit: (s: any) => void = () => {}) => {
  const clock = makeClock()
  const e = makeEngine(clock, (s) => { s.ui.tutorialDone = true; s.rngSeed = 9; edit(s) })
  return { e, clock }
}
const one = (q: Omit<Quest, 'id'>) => [{ id: 1, ...q }]

test('no quests until the tutorial is done', () => {
  const e = makeEngine(makeClock())
  fillQuests(e, 0)
  assert.deepEqual(e.state.quests.active, [])
})

test('new game after the tutorial: three quests of different kinds, nothing impossible', () => {
  const { e } = afterTutorial()
  fillQuests(e, 0)
  const kinds = e.state.quests.active.map((q) => q.kind)
  assert.equal(kinds.length, 3)
  assert.equal(new Set(kinds).size, 3)
  assert.ok(!kinds.includes('hire') && !kinds.includes('unlock') && !kinds.includes('upgrade') && !kinds.includes('promote'), kinds.join())
  assert.deepEqual(e.state.quests.active.map((q) => q.id), [1, 2, 3])
})

test('earn: money made since the quest was given completes it and a new one takes its place', () => {
  const { e } = afterTutorial()
  e.state.quests.active = one({ kind: 'earn', jobId: null, target: 300, base: 0 })
  e.state.quests.seq = 1
  e.state.stats.earned = 299
  assert.equal(completeQuests(e, 0), 0)
  e.state.stats.earned = 300
  assert.equal(completeQuests(e, 0), 1)
  assert.equal(e.state.stars, 1)
  assert.equal(e.state.quests.active.length, 3)
  assert.ok(e.state.quests.active.every((q) => q.id > 1))
})

test('collect: taps on ready jobs count from the moment the quest was given', () => {
  const { e, clock } = afterTutorial()
  e.state.stats.collects = 5
  e.state.quests.active = one({ kind: 'collect', jobId: null, target: 2, base: 5 })
  clock.t = 1000
  e.tap('reboot')
  assert.deepEqual(questProgress(e, e.state.quests.active[0]), { value: 1, target: 2 })
  clock.t = 2000
  e.tap('reboot')
  assert.equal(completeQuests(e, clock.t), 1)
})

test('level: reaching the target level completes it', () => {
  const { e } = afterTutorial((s) => { s.jobs.reboot.level = 25 })
  e.state.quests.active = one({ kind: 'level', jobId: 'reboot', target: 25, base: 1 })
  assert.equal(completeQuests(e, 0), 1)
})

test('a player with every manager hired gets no collect quest', () => {
  const { e } = afterTutorial((s) => {
    for (const id of Object.keys(s.jobs)) s.jobs[id] = { level: 10, rank: 0, hasManager: true, startedAt: 0 }
  })
  for (let i = 0; i < 20; i++) {
    e.state.quests.active = []
    fillQuests(e, 0)
    assert.ok(!e.state.quests.active.some((q) => q.kind === 'collect'))
  }
})

test('reroll: free once per 4 hours, the new quest is of another kind', () => {
  const { e } = afterTutorial()
  fillQuests(e, 0)
  const first = e.state.quests.active[0]
  assert.equal(rerollQuest(e, first.id, 1000), true)
  assert.ok(!e.state.quests.active.some((q) => q.id === first.id))
  assert.equal(e.state.quests.active.length, 3)
  assert.equal(rerollQuest(e, e.state.quests.active[0].id, 2000), false)
  assert.equal(rerollQuest(e, e.state.quests.active[0].id, 1000 + 4 * 3600_000), true)
})

test('offline income counts for an earn quest after resume', () => {
  const { e, clock } = afterTutorial((s) => { s.jobs.reboot = { level: 10, rank: 0, hasManager: true, startedAt: 0 } })
  e.state.quests.active = one({ kind: 'earn', jobId: null, target: 1000, base: 0 })
  clock.t = 3600_000
  e.resume(clock.t)
  assert.equal(completeQuests(e, clock.t), 1)
})

test('beautify rounds up to two significant digits', () => {
  assert.equal(beautify(12_345), 13_000)
  assert.equal(beautify(300), 300)
  assert.equal(beautify(7), 50)
})
