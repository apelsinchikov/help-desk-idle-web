// Тексты тостов при повышении и надписи кнопки повышения. Возвращает ключи строк, перевод — в UI.
import type { Milestone } from './content.ts'

/** `key` — ключ строки; строки в `args` — тоже ключи (переводятся перед подстановкой), числа — как есть. */
export type AchievementText = { key: string; args: (string | number | { money: number })[] }

/** Работы 3 и 7 (бухгалтерия): сквозная шутка Людмилы Петровны из CONTENT.md. */
const LYUDMILA_JOBS = new Set([2, 6])
const LYUDMILA_LEVELS = new Set([25, 50, 100, 200, 300, 400])

export function achievementText(m: Milestone, jobIndex: number): AchievementText {
  if (m.jobId === null) return { key: 'ach.all', args: [m.level, `effect.${m.effect}`, m.value] }
  if (LYUDMILA_JOBS.has(jobIndex) && LYUDMILA_LEVELS.has(m.level)) return { key: `ach.lyudmila.${m.level}`, args: [] }
  return { key: 'ach.job', args: [`job.${m.jobId}.title`, m.level, `effect.${m.effect}`, m.value] }
}

/** Надпись кнопки повышения по номеру порога работы (0 — первый порог): 8 фраз по кругу. */
export function promotionLabelKey(milestoneIndex: number): string {
  return `promo.${(milestoneIndex % 8) + 1}`
}
