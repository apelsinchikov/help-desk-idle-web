// Тексты тостов при повышении и надписи кнопки повышения. Возвращает ключи строк, перевод — в UI.
import type { Milestone } from './content.ts'

/** Награда порога: ключ эффекта и множитель. */
export type MilestoneReward = { effect: string; value: number }

/**
 * `key` — ключ строки; строки в `args` — тоже ключи (переводятся перед подстановкой), числа — как есть,
 * `{ money }` — сумма, `{ rewards }` — список наград «скорость ×2, прибыль ×1,5».
 */
export type AchievementText = { key: string; args: (string | number | { money: number } | { rewards: MilestoneReward[] })[] }

/** Работы 3 и 7 (бухгалтерия): сквозная шутка Людмилы Петровны из CONTENT.md. */
const LYUDMILA_JOBS = new Set([2, 6])
const LYUDMILA_LEVELS = new Set([25, 50, 100, 200, 300, 400])

export const rewardsOf = (list: readonly Milestone[]): MilestoneReward[] => list.map((m) => ({ effect: `effect.${m.effect}`, value: m.value }))

/** Один тост на порог: после 100-го уровня на одном пороге бывает и скорость, и прибыль. */
export function achievementText(list: readonly Milestone[], jobIndex: number): AchievementText {
  const { jobId, level } = list[0]
  if (jobId === null) return { key: 'ach.all', args: [level, { rewards: rewardsOf(list) }] }
  if (LYUDMILA_JOBS.has(jobIndex) && LYUDMILA_LEVELS.has(level)) return { key: `ach.lyudmila.${level}`, args: [] }
  return { key: 'ach.job', args: [`job.${jobId}.title`, level, { rewards: rewardsOf(list) }] }
}

/** Пороги, сгруппированные по работе и уровню, — в порядке появления. */
export function groupMilestones(list: readonly Milestone[]): Milestone[][] {
  const groups = new Map<string, Milestone[]>()
  for (const m of list) {
    const key = `${m.jobId}:${m.level}`
    groups.set(key, [...(groups.get(key) ?? []), m])
  }
  return [...groups.values()]
}

/** Надпись кнопки повышения по номеру порога работы (0 — первый порог): 8 фраз по кругу. */
export function promotionLabelKey(milestoneIndex: number): string {
  return `promo.${(milestoneIndex % 8) + 1}`
}
