// Мультипликаторы от порогов уровней (достижений). Порт MilestoneMath.swift.
// `levels` должен содержать уровни ВСЕХ работ (закрытая = 0) — от этого зависят глобальные пороги.
import type { Milestone, MilestoneEffect } from './content.ts'

export function speedMultiplier(jobId: string, levels: Record<string, number>, milestones: readonly Milestone[]): number {
  return multiplier('speed', jobId, levels, milestones)
}

export function profitMultiplier(jobId: string, levels: Record<string, number>, milestones: readonly Milestone[]): number {
  return multiplier('profit', jobId, levels, milestones)
}

/** Ближайший ещё не достигнутый порог этой работы. */
export function nextMilestone(jobId: string, level: number, milestones: readonly Milestone[]): Milestone | undefined {
  let best: Milestone | undefined
  for (const m of milestones) {
    if (m.jobId === jobId && m.level > level && (!best || m.level < best.level)) best = m
  }
  return best
}

function multiplier(
  effect: MilestoneEffect,
  jobId: string,
  levels: Record<string, number>,
  milestones: readonly Milestone[],
): number {
  const own = levels[jobId] ?? 0
  const values = Object.values(levels)
  const lowest = values.length > 0 ? Math.min(...values) : 0
  let result = 1
  for (const m of milestones) {
    if (m.effect !== effect) continue
    if (m.jobId !== null) {
      if (m.jobId === jobId && own >= m.level) result *= m.value
    } else if (lowest >= m.level) {
      result *= m.value
    }
  }
  return result
}
