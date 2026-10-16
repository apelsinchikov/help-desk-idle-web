import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bundledContent as c } from './bundled.ts'
import { makeClock, makeEngine } from './testkit.ts'
import { compareEquip, markItemsSeen, nextItem } from './items.ts'

test('items come in file order: all common first, then rare, …, then none', () => {
  const e = makeEngine(makeClock())
  assert.equal(nextItem(c, e.state)!.id, 'helpdesk_cap')
  for (let i = 0; i < 7; i++) e.grantItem(nextItem(c, e.state)!.id)
  assert.equal(nextItem(c, e.state)!.id, 'notabug_glasses')
  for (let i = 0; i < 21; i++) e.grantItem(nextItem(c, e.state)!.id)
  assert.equal(nextItem(c, e.state), null)
})

test('a new item goes to the backpack and is not put on by itself', () => {
  const e = makeEngine(makeClock())
  e.grantItem('look_glasses')
  assert.equal(e.state.items.equipped.glasses, undefined)
  e.equip('look_glasses')
  e.grantItem('notabug_glasses')
  assert.equal(e.state.items.equipped.glasses, 'look_glasses')
  assert.deepEqual(e.state.items.owned, ['look_glasses', 'notabug_glasses'])
  assert.equal(e.equip('notabug_glasses'), true)
  assert.equal(e.state.items.equipped.glasses, 'notabug_glasses')
  assert.equal(e.equip('prod_helmet'), false, 'чужую вещь не надеть')
  e.unequip('glasses')
  assert.equal(e.state.items.equipped.glasses, undefined)
})

test('compare shows every changed stat and the item that comes off', () => {
  const e = makeEngine(makeClock())
  e.grantItem('notabug_glasses') // скорость +100%
  e.equip('notabug_glasses')
  e.grantItem('look_glasses') // зарплата +10%, в рюкзаке
  const cmp = compareEquip(c, e.state, 'look_glasses')
  assert.equal(cmp.removes, 'notabug_glasses')
  assert.deepEqual(cmp.rows, [
    { stat: 'speed', before: 1, after: 0, verdict: 'worse' },
    { stat: 'salary', before: 0, after: 0.1, verdict: 'better' },
  ])
})

test('putting on a speed item mid-cycle keeps the cycle fraction', () => {
  const clock = makeClock()
  const e = makeEngine(clock, (s) => { s.jobs.reboot = { level: 10, rank: 0, hasManager: true, startedAt: 0 } })
  clock.t = 300
  e.grantItem('dont_touch_mug') // скорость +100%
  e.equip('dont_touch_mug')
  const st = e.status('reboot') as any
  assert.ok(Math.abs(st.progress - 0.5) < 1e-9)
  clock.t = 450
  assert.equal(e.advance(clock.t), 10)
})

test('opening the items tab marks every new item as seen', () => {
  const e = makeEngine(makeClock())
  e.grantItem('helpdesk_cap')
  e.grantItem('look_glasses')
  markItemsSeen(e.state)
  assert.deepEqual(e.state.items.seen, ['helpdesk_cap', 'look_glasses'])
})
