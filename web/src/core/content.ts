/** Неизменяемое описание работы (аналог бизнеса AdCap). Значения — из `jobs.json`. */
export type JobDefinition = {
  id: string
  order: number
  baseCost: number
  growthRate: number
  time: number
  revenue: number
  unlockLevel: number
  managerCost: number
  iconKey: string
}

export type MilestoneEffect = 'speed' | 'profit'

/** Порог уровня → эффект. `jobId === null` — глобальный порог (все работы ≥ level). */
export type Milestone = {
  jobId: string | null
  level: number
  effect: MilestoneEffect
  value: number
}

export type GameConfig = {
  offlineCapHours: number
  autosaveSeconds: number
  /** Цикл короче этого порога (секунды) у работы с менеджером считается «потоком». */
  fastCycleThreshold: number
  /** С какого уровня работы можно нанять менеджера. */
  managerMinLevel: number
  /** Повышение на пороге стоит как столько следующих уровней работы. */
  promotionLevels: number
}

/** Разовое улучшение за деньги: прибыль работы (или всех, jobId = null) ×value. */
export type UpgradeDefinition = {
  id: string
  jobId: string | null
  cost: number
  effect: 'profit'
  value: number
}

/** Весь баланс игры, загруженный из JSON. */
export class GameContent {
  /** Отсортированы по `order`. */
  readonly jobs: readonly JobDefinition[]
  readonly milestones: readonly Milestone[]
  readonly config: GameConfig
  /** Отсортированы по цене. */
  readonly upgrades: readonly UpgradeDefinition[]

  constructor(
    jobs: readonly JobDefinition[],
    milestones: readonly Milestone[],
    config: GameConfig,
    upgrades: readonly UpgradeDefinition[] = [],
  ) {
    this.jobs = [...jobs].sort((a, b) => a.order - b.order)
    this.milestones = milestones.map((m) => ({ ...m, jobId: m.jobId ?? null }))
    this.config = config
    this.upgrades = upgrades.map((u) => ({ ...u, jobId: u.jobId ?? null })).sort((a, b) => a.cost - b.cost)
  }

  upgrade(id: string): UpgradeDefinition | undefined {
    return this.upgrades.find((u) => u.id === id)
  }

  /** Свои пороги работы по возрастанию (25, 50, 100, …). */
  milestoneLevels(jobId: string): number[] {
    return [...new Set(this.milestones.filter((m) => m.jobId === jobId).map((m) => m.level))].sort((a, b) => a - b)
  }

  job(id: string): JobDefinition | undefined {
    return this.jobs.find((j) => j.id === id)
  }

  previousJob(id: string): JobDefinition | undefined {
    const index = this.jobs.findIndex((j) => j.id === id)
    return index > 0 ? this.jobs[index - 1] : undefined
  }
}
