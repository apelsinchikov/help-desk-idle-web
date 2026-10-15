// Вся игровая логика этапа 1. Порт GameEngine.swift.
// Прогресс работ вычисляется из `startedAt`, поэтому одинаково работает онлайн (тик) и оффлайн (`resume`).
import type { GameContent, Milestone } from './content.ts'
import { bulkCost, cycle, maxAffordable, nextCost, payout } from './economy.ts'
import { nextMilestone, profitMultiplier, speedMultiplier } from './milestones.ts'
import { newGame } from './state.ts'
import type { BuyMode, GameState, JobStatus, OfflineReport, PlayerSettings } from './state.ts'

export class GameEngine {
  readonly content: GameContent
  private current: GameState
  private readonly now: () => number

  constructor(content: GameContent, state: GameState, now: () => number = Date.now) {
    this.content = content
    this.current = withAllJobs(content, state)
    this.now = now
  }

  get state(): GameState {
    return this.current
  }

  // MARK: - Расчёты

  level(jobId: string): number {
    return this.current.jobs[jobId]?.level ?? 0
  }

  private levels(): Record<string, number> {
    const result: Record<string, number> = {}
    for (const job of this.content.jobs) result[job.id] = this.level(job.id)
    return result
  }

  /** Длительность цикла, секунды. */
  cycle(jobId: string): number {
    const job = this.content.job(jobId)
    if (!job) return Infinity
    return cycle(job.time, speedMultiplier(jobId, this.levels(), this.content.milestones))
  }

  payout(jobId: string): number {
    const job = this.content.job(jobId)
    if (!job) return 0
    return payout(job.revenue, this.level(jobId), profitMultiplier(jobId, this.levels(), this.content.milestones))
  }

  nextMilestone(jobId: string): Milestone | undefined {
    return nextMilestone(jobId, this.level(jobId), this.content.milestones)
  }

  /** Доход в секунду от работ с менеджерами. */
  get incomePerSecond(): number {
    let sum = 0
    for (const job of this.content.jobs) {
      const js = this.current.jobs[job.id]
      if (js && js.level > 0 && js.hasManager) sum += this.payout(job.id) / this.cycle(job.id)
    }
    return sum
  }

  // MARK: - Статус

  status(jobId: string, at: number = this.now()): JobStatus {
    const js = this.current.jobs[jobId]
    if (!js || !this.content.job(jobId)) return { kind: 'locked', requirementMet: false }
    if (js.level === 0) return { kind: 'locked', requirementMet: this.requirementMet(jobId) }

    const duration = this.cycle(jobId)
    if (js.hasManager && duration < this.content.config.fastCycleThreshold) {
      return { kind: 'streaming', perSecond: this.payout(jobId) / duration }
    }
    if (js.startedAt === null) return { kind: 'idle' }

    const elapsed = Math.max(0, (at - js.startedAt) / 1000)
    if (elapsed >= duration) {
      if (!js.hasManager) return { kind: 'ready' }
      const into = elapsed % duration
      return { kind: 'running', progress: into / duration, remaining: duration - into }
    }
    return { kind: 'running', progress: elapsed / duration, remaining: duration - elapsed }
  }

  private requirementMet(jobId: string): boolean {
    const job = this.content.job(jobId)
    if (!job) return false
    const previous = this.content.previousJob(jobId)
    if (!previous) return true
    return this.level(previous.id) >= job.unlockLevel
  }

  // MARK: - Действия игрока

  /** Тап по строке работы (без менеджера): idle → старт цикла; ready → сбор денег, работа встаёт. */
  tap(jobId: string): void {
    const now = this.now()
    const js = this.current.jobs[jobId]
    switch (this.status(jobId, now).kind) {
      case 'idle':
        js.startedAt = now
        break
      case 'ready':
        this.credit(this.payout(jobId))
        js.startedAt = null
        break
    }
  }

  quote(jobId: string, mode: BuyMode): { count: number; cost: number } {
    const job = this.content.job(jobId)
    if (!job) return { count: 0, cost: Infinity }
    const owned = this.level(jobId)
    let count: number
    switch (mode) {
      case 'one': count = 1; break
      case 'ten': count = 10; break
      case 'hundred': count = 100; break
      case 'max':
        count = maxAffordable(job.baseCost, job.growthRate, owned, this.current.money)
        if (count === 0) return { count: 0, cost: nextCost(job.baseCost, job.growthRate, owned) }
    }
    return { count, cost: bulkCost(job.baseCost, job.growthRate, owned, count) }
  }

  buy(jobId: string, mode: BuyMode): boolean {
    if (this.level(jobId) < 1) return false
    const q = this.quote(jobId, mode)
    if (q.count <= 0 || !Number.isFinite(q.cost) || q.cost > this.current.money) return false
    this.current.money -= q.cost
    this.current.jobs[jobId].level += q.count
    return true
  }

  canUnlock(jobId: string): boolean {
    const job = this.content.job(jobId)
    if (!job || this.level(jobId) !== 0) return false
    return this.requirementMet(jobId) && this.current.money >= job.baseCost
  }

  unlock(jobId: string): boolean {
    const job = this.content.job(jobId)
    if (!job || !this.canUnlock(jobId)) return false
    this.current.money -= job.baseCost
    this.current.jobs[jobId].level = 1
    return true
  }

  canHireManager(jobId: string): boolean {
    const job = this.content.job(jobId)
    const js = this.current.jobs[jobId]
    if (!job || !js) return false
    return js.level >= 1 && !js.hasManager && this.current.money >= job.managerCost
  }

  hireManager(jobId: string): boolean {
    const job = this.content.job(jobId)
    if (!job || !this.canHireManager(jobId)) return false
    const js = this.current.jobs[jobId]
    this.current.money -= job.managerCost
    js.hasManager = true
    if (js.startedAt === null) js.startedAt = this.now()
    return true
  }

  updateSettings(patch: Partial<PlayerSettings>): void {
    this.current.settings = { ...this.current.settings, ...patch }
  }

  // MARK: - Время

  /**
   * Догоняет время до `now`: работы с менеджером собирают все завершённые циклы.
   * `capSeconds` — максимум учитываемого времени (оффлайн-лимит). Возвращает заработанное.
   */
  advance(now: number, capSeconds?: number): number {
    let earned = 0
    for (const job of this.content.jobs) {
      const js = this.current.jobs[job.id]
      if (!js || js.level <= 0 || !js.hasManager) continue
      let start = js.startedAt ?? now
      if (start > now) start = now // часы перевели назад
      if (capSeconds !== undefined) start = Math.max(start, now - capSeconds * 1000)

      const duration = this.cycle(job.id)
      const completed = Math.floor((now - start) / 1000 / duration)
      if (completed > 0 && Number.isFinite(completed)) {
        earned += this.payout(job.id) * completed
        start += completed * duration * 1000
      }
      js.startedAt = start
    }
    this.credit(earned)
    // Следуем за часами и назад: иначе после «назад, потом вперёд» скачок прошёл бы мимо оффлайн-лимита.
    this.current.lastActiveAt = now
    return earned
  }

  /** Возврат в игру. null — если отсутствие было короче минуты или часы ушли назад. */
  resume(now: number): OfflineReport | null {
    const elapsed = (now - this.current.lastActiveAt) / 1000
    if (elapsed < 60) {
      this.advance(now)
      return null
    }
    const earned = this.advance(now, this.content.config.offlineCapHours * 3600)
    const readyJobs = this.content.jobs.filter((j) => this.status(j.id, now).kind === 'ready').length
    return { elapsed, earned, readyJobs }
  }

  /** Начать заново (настройки сохраняются). */
  reset(now: number): void {
    const settings = this.current.settings
    this.current = newGame(this.content, now, settings.language)
    this.current.settings = settings
  }

  /** Подменить состояние целиком (загрузка из облака). */
  replaceState(state: GameState): void {
    this.current = withAllJobs(this.content, state)
  }

  private credit(amount: number): void {
    if (!(amount > 0) || !Number.isFinite(amount)) return
    this.current.money += amount
    this.current.lifetimeEarnings += amount
  }
}

/** В сейве есть запись для каждой работы из контента (новые работы в jobs.json, старые сейвы). */
function withAllJobs(content: GameContent, state: GameState): GameState {
  for (const job of content.jobs) {
    state.jobs[job.id] ??= { level: 0, hasManager: false, startedAt: null }
  }
  return state
}
