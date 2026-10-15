import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bundledContent } from './bundled.ts'

test('bundled content has 12 jobs in order', () => {
  const c = bundledContent
  assert.equal(c.jobs.length, 12)
  assert.equal(c.jobs[0].id, 'reboot')
  assert.equal(c.jobs.at(-1)!.id, 'ddos_rivals')
  assert.equal(c.job('plug_mouse')!.baseCost, 60)
  assert.equal(c.job('ddos_rivals')!.time, 36864)
  assert.equal(c.previousJob('plug_mouse')!.id, 'reboot')
  assert.equal(c.previousJob('reboot'), undefined)
  assert.equal(c.config.offlineCapHours, 24)
})

test('every job has a level-25 milestone', () => {
  const c = bundledContent
  for (const job of c.jobs) {
    assert.ok(
      c.milestones.some((m) => m.jobId === job.id && m.level === 25),
      `нет порога 25 у ${job.id}`,
    )
  }
})

test('stage 2a balance config and cash upgrades', () => {
  const c = bundledContent
  assert.equal(c.config.managerMinLevel, 100)
  assert.equal(c.config.promotionFactor, 2)
  assert.equal(c.upgrades.length, 13)
  assert.deepEqual(
    { id: c.upgrades[0].id, jobId: c.upgrades[0].jobId, cost: c.upgrades[0].cost },
    { id: 'reboot_x3', jobId: 'reboot', cost: 25_000_000 },
  )
  const coffee = c.upgrade('coffee_machine')!
  assert.equal(coffee.jobId, null)
  assert.equal(coffee.cost, 1_000_000_000_000)
  assert.equal(coffee.value, 3)
  assert.deepEqual(c.milestoneLevels('reboot').slice(0, 6), [25, 50, 100, 200, 300, 400])
})
