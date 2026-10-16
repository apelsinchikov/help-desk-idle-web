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
  assert.equal(c.config.offlineCapHours, 2)
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
  assert.equal(c.config.managerMinRank, 50)
  assert.equal(c.config.promotionFactor, 4)
  assert.equal(c.upgrades.length, 13)
  assert.deepEqual(
    { id: c.upgrades[0].id, jobId: c.upgrades[0].jobId, cost: c.upgrades[0].cost },
    { id: 'reboot_x3', jobId: 'reboot', cost: 75_000_000 },
  )
  const coffee = c.upgrade('coffee_machine')!
  assert.equal(coffee.jobId, null)
  assert.equal(coffee.cost, 3_000_000_000_000)
  assert.equal(coffee.value, 3)
  assert.deepEqual(c.milestoneLevels('reboot').slice(0, 6), [25, 50, 75, 100, 150, 200])
  const speed = c.milestones.filter((m) => m.jobId === 'reboot' && m.effect === 'speed').map((m) => m.level)
  assert.deepEqual(speed.slice(0, 6), [25, 50, 100, 200, 300, 400])
})

test('thresholds: every 25 up to 100, every 50 up to 300, every 100 up to 1000, then every 250; dropped rewards folded up', () => {
  const c = bundledContent
  const step = (l: number) => (l <= 100 ? 25 : l <= 300 ? 50 : l <= 1000 ? 100 : 250)
  for (const job of c.jobs) {
    const levels = c.milestoneLevels(job.id)
    let expected = 25
    for (const l of levels) {
      assert.equal(l, expected, `${job.id}: порог ${l}, ожидали ${expected}`)
      expected += step(expected + 1)
    }
  }
  const at = (jobId: string, level: number) =>
    c.milestones.filter((m) => m.jobId === jobId && m.level === level).map((m) => [m.effect, m.value])
  assert.deepEqual(at('plug_mouse', 75), [['profit', 1.5]])
  assert.deepEqual(at('reboot', 150), [['profit', 2.25]], '125 (×1,5) + 150 (×1,5)')
  assert.deepEqual(at('reboot', 200), [['speed', 2], ['profit', 1.5]], '175 (×1,5) переехал на 200')
})

test('manager rank: jobs 1-4 after the first promotion, the rest after the second', () => {
  const c = bundledContent
  assert.deepEqual(c.jobs.map((j) => c.managerRank(j.id)), [25, 25, 25, 25, 50, 50, 50, 50, 50, 50, 50, 50])
})

test('stage 2b perks catalog', () => {
  const c = bundledContent
  assert.equal(c.perks.length, 33)
  assert.deepEqual(c.perk('speed_200_60'), { id: 'speed_200_60', kind: 'speed', value: 2, minutes: 60 })
  assert.deepEqual(c.perk('level_25_5'), { id: 'level_25_5', kind: 'levelDiscount', value: 0.25, minutes: 5 })
  assert.equal(c.perk('salary_30_10')!.value, 0.3)
  assert.deepEqual(c.perk('rewind_15'), { id: 'rewind_15', kind: 'rewind', value: 0, minutes: 15 })
  const count = (kind: string) => c.perks.filter((p) => p.kind === kind).length
  assert.deepEqual([count('speed'), count('levelDiscount'), count('salary'), count('rewind')], [13, 8, 8, 4])
  assert.deepEqual(c.perk('energy_drink'), { id: 'energy_drink', kind: 'speed', value: 0.3, minutes: 5 })
  assert.deepEqual(c.config.energy, { perkId: 'energy_drink', minutesPerCan: 5, cans: 5 })
})

test('stage 2b wardrobe items: 7 per rarity, one per slot, stats by the spec table', () => {
  const c = bundledContent
  assert.equal(c.items.length, 28)
  assert.deepEqual(
    { ...c.items[0] },
    { id: 'helpdesk_cap', slot: 'head', rarity: 'common', stat: 'speed', value: 0.5, iconKey: 'slot_head' },
  )
  const values: Record<string, number[]> = {
    speed: [0.5, 1, 1.5, 2], levelDiscount: [0.03, 0.05, 0.08, 0.1], gradeDiscount: [0.05, 0.1, 0.15, 0.2], salary: [0.1, 0.15, 0.2, 0.3],
  }
  const rarities = ['common', 'rare', 'epic', 'legendary'] as const
  rarities.forEach((rarity, r) => {
    const set = c.items.filter((i) => i.rarity === rarity)
    assert.equal(set.length, 7, rarity)
    assert.equal(new Set(set.map((i) => i.slot)).size, 7, `${rarity}: слоты`)
    const stats = set.map((i) => i.stat).sort()
    assert.deepEqual(stats, ['gradeDiscount', 'levelDiscount', 'levelDiscount', 'salary', 'salary', 'speed', 'speed'])
    for (const i of set) assert.equal(i.value, values[i.stat][r], i.id)
  })
  // порядок выдачи: редкости по возрастанию
  assert.deepEqual(c.items.map((i) => rarities.indexOf(i.rarity)), [...c.items.map((i) => rarities.indexOf(i.rarity))].sort())
  assert.equal(c.item('board_shoes')!.rarity, 'legendary')
})

test('stage 2b chests and config', () => {
  const c = bundledContent
  assert.deepEqual(c.chests.map((ch) => ch.id), ['hr_gift', 'corporate_party', 'funding_round', 'ipo'])
  assert.deepEqual(c.chests[0].items, [{ rarity: 'common', chance: 0.3 }])
  assert.deepEqual(c.chests[2].items, [{ rarity: 'rare', chance: 0.7 }, { rarity: 'epic', chance: 0.25 }, { rarity: 'legendary', chance: 0.005 }])
  assert.deepEqual(c.chests.map((ch) => ch.perks), [[1, 1], [3, 5], [5, 9], [9, 15]])
  assert.equal(c.chests[0].currency, 'techcoin')
  assert.equal(c.config.effects.levelDiscountCap, 0.6)
  assert.deepEqual(c.config.messages, { seconds: 20, toastSeconds: 10, ticketEverySeconds: 180, tickets: 50 })
  assert.deepEqual(c.config.track.tiers.map((t) => t.fromStars), [0, 50, 100, 150])
  assert.deepEqual(c.config.track.tiers[0], { fromStars: 0, minutes: [5], speed: [1], levelDiscount: [0.15], salary: [0.1], rewind: [10] })
  assert.deepEqual(c.config.track.tiers[3].speed, [1, 1.5, 2])
  assert.deepEqual(c.config.track.weights, { speed: 30, salary: 25, levelDiscount: 25, rewind: 20 })
  assert.deepEqual(c.config.track.itemStars, { common: 10, rare: 20, epic: 40, legendary: 80 })
  assert.deepEqual(c.config.quests, { minMinutes: 5, maxMinutes: 15, rerollHours: 4, collect: [30, 60] })
})
