// Вся игровая логика этапа 1. Порт GameEngine.swift.
// Прогресс работ вычисляется из `startedAt`, поэтому одинаково работает онлайн (тик) и оффлайн (`resume`).
import type { GameContent, Milestone, Slot } from './content.ts'
import { bulkCost, cycle, maxAffordable, nextCost, payout } from './economy.ts'
import { nextMilestone, profitMultiplier, speedMultiplier } from './milestones.ts'
import { newGame } from './state.ts'
import { statTotals } from './modifiers.ts'
import type { Stats } from './modifiers.ts'
import type { BuyMode, GameState, JobStatus, OfflineReport, PlayerSettings } from './state.ts'

export class GameEngine {
  readonly content: GameContent
  private current: GameState
  private readonly now: () => number

  constructor(content: GameContent, state: GameState, now: () => number = Date.now) {
    this.content = content
    this.current = withAllJobs(content, state)
    this.now = now
    this.startIdleJobs()
  }

  /** Открытые работы не простаивают: без менеджера цикл идёт сам, ждём только сбора денег. */
  private startIdleJobs(): void {
    const now = this.now()
    for (const job of this.content.jobs) {
      const js = this.current.jobs[job.id]
      if (js && js.level > 0 && js.startedAt === null) js.startedAt = now
    }
  }

  get state(): GameState {
    return this.current
  }

  // MARK: - Расчёты

  level(jobId: string): number {
    return this.current.jobs[jobId]?.level ?? 0
  }

  /** Последний оплаченный порог работы. */
  rank(jobId: string): number {
    return this.current.jobs[jobId]?.rank ?? 0
  }

  /** Ранги всех работ (закрытая = 0): от них зависят награды порогов, в том числе глобальные. */
  private ranks(): Record<string, number> {
    const result: Record<string, number> = {}
    for (const job of this.content.jobs) result[job.id] = this.rank(job.id)
    return result
  }

  /** Потолок уровней: ближайший свой порог выше ранга; Infinity — порогов больше нет. */
  cap(jobId: string): number {
    const rank = this.rank(jobId)
    return this.content.milestoneLevels(jobId).find((l) => l > rank) ?? Infinity
  }

  /** Уровень упёрся в порог — дальше только повышение. */
  atCap(jobId: string): boolean {
    const level = this.level(jobId)
    return level >= 1 && level >= this.cap(jobId)
  }

  /** Менеджер нанят, но стоит: работа на пороге ждёт повышения. */
  managerWaiting(jobId: string): boolean {
    return (this.current.jobs[jobId]?.hasManager ?? false) && this.atCap(jobId)
  }

  /**
   * Повышение стоит как `promotionFactor` × пройденный отрезок уровней (от прошлого порога до текущего) —
   * соразмерно кривой цен этой работы (Pecorella, Part I: множители держат доход рядом с ценами).
   */
  promotionCost(jobId: string): number {
    const job = this.content.job(jobId)
    if (!job) return Infinity
    const from = this.rank(jobId)
    const to = Math.min(this.cap(jobId), this.level(jobId))
    return this.content.config.promotionFactor * bulkCost(job.baseCost, job.growthRate, from, to - from)
  }

  /** Множитель прибыли от купленных улучшений (своё ×3, «Кофемашина» ×3 всем). */
  upgradeMultiplier(jobId: string): number {
    let result = 1
    for (const id of this.current.upgrades) {
      const up = this.content.upgrade(id)
      if (up && (up.jobId === null || up.jobId === jobId)) result *= up.value
    }
    return result
  }

  /** Бонусы вещей и перков в момент `at`. */
  stats(at: number = this.now()): Stats {
    return statTotals(this.content, this.current, at)
  }

  /** Длительность цикла, секунды (пороги × бонус скорости вещей и перков в момент `at`). */
  cycle(jobId: string, at: number = this.now()): number {
    return this.cycleWith(jobId, this.stats(at))
  }

  private cycleWith(jobId: string, stats: Stats): number {
    const job = this.content.job(jobId)
    if (!job) return Infinity
    return cycle(job.time, speedMultiplier(jobId, this.ranks(), this.content.milestones) * (1 + stats.speed))
  }

  payout(jobId: string, at: number = this.now()): number {
    const job = this.content.job(jobId)
    if (!job) return 0
    const profit = profitMultiplier(jobId, this.ranks(), this.content.milestones) * this.upgradeMultiplier(jobId)
    return payout(job.revenue, this.level(jobId), profit) * (1 + this.stats(at).salary)
  }

  /** Множитель цены уровней (скидка вещей и перков). Повышение на пороге — без скидки. */
  private priceFactor(): number {
    return 1 - this.stats().levelDiscount
  }

  nextMilestone(jobId: string): Milestone | undefined {
    return nextMilestone(jobId, this.rank(jobId), this.content.milestones)
  }

  /** Доход в секунду от работ с менеджерами. */
  get incomePerSecond(): number {
    let sum = 0
    for (const job of this.content.jobs) {
      const js = this.current.jobs[job.id]
      if (js && js.level > 0 && js.hasManager && !this.atCap(job.id)) sum += this.payout(job.id) / this.cycle(job.id)
    }
    return sum
  }

  // MARK: - Статус

  status(jobId: string, at: number = this.now()): JobStatus {
    const js = this.current.jobs[jobId]
    if (!js || !this.content.job(jobId)) return { kind: 'locked', requirementMet: false }
    if (js.level === 0) return { kind: 'locked', requirementMet: this.requirementMet(jobId) }

    const duration = this.cycle(jobId)
    // на пороге менеджер ждёт повышения — работа идёт только вручную
    const managed = js.hasManager && !this.atCap(jobId)
    if (managed && duration < this.content.config.fastCycleThreshold) {
      return { kind: 'streaming', perSecond: this.payout(jobId) / duration }
    }
    if (js.startedAt === null) return { kind: 'idle' }

    const elapsed = Math.max(0, (at - js.startedAt) / 1000)
    if (elapsed >= duration) {
      if (!managed) return { kind: 'ready' }
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
        // один тап: забрать деньги — и следующий цикл стартует сам
        this.credit(this.payout(jobId))
        this.current.stats.collects++
        js.startedAt = now
        break
    }
  }

  quote(jobId: string, mode: BuyMode): { count: number; cost: number } {
    const job = this.content.job(jobId)
    if (!job) return { count: 0, cost: Infinity }
    if (this.atCap(jobId)) return { count: 0, cost: this.promotionCost(jobId) }
    const owned = this.level(jobId)
    const room = this.cap(jobId) - owned
    const f = this.priceFactor()
    const price = (n: number) => bulkCost(job.baseCost, job.growthRate, owned, n) * f
    let count: number
    switch (mode) {
      case 'one': count = 1; break
      case 'ten': count = 10; break
      case 'hundred': count = 100; break
      case 'max':
        count = maxAffordable(job.baseCost, job.growthRate, owned, this.current.money / f)
        while (count > 0 && price(count) > this.current.money) count-- // погрешность деления
        if (count === 0) return { count: 0, cost: nextCost(job.baseCost, job.growthRate, owned) * f }
    }
    count = Math.min(count, room)
    return { count, cost: price(count) }
  }

  buy(jobId: string, mode: BuyMode): boolean {
    if (this.level(jobId) < 1) return false
    const q = this.quote(jobId, mode)
    if (q.count <= 0 || !Number.isFinite(q.cost) || q.cost > this.current.money) return false
    this.advance(this.now()) // менеджер дособирает завершённые циклы, пока не упёрся в порог
    this.current.money -= q.cost
    this.current.jobs[jobId].level += q.count
    return true
  }

  /**
   * Повышение на пороге: списывает цену, ранг = потолок, открывает следующий отрезок уровней.
   * Возвращает пороги, ставшие активными (свой и глобальные), или null, если повысить нельзя.
   */
  promote(jobId: string): Milestone[] | null {
    if (!this.atCap(jobId)) return null
    const cost = this.promotionCost(jobId)
    if (!Number.isFinite(cost) || cost > this.current.money) return null
    const before = new Set(this.activeMilestones())
    this.current.money -= cost
    const js = this.current.jobs[jobId]
    js.rank = this.cap(jobId)
    // менеджер снова работает сам
    if (js.hasManager && js.startedAt === null) js.startedAt = this.now()
    return this.activeMilestones().filter((m) => !before.has(m))
  }

  /** Пороги, чья награда сейчас действует. */
  private activeMilestones(): Milestone[] {
    const ranks = this.ranks()
    const lowest = Math.min(...Object.values(ranks))
    return this.content.milestones.filter((m) => (m.jobId === null ? lowest >= m.level : (ranks[m.jobId] ?? 0) >= m.level))
  }

  canBuyUpgrade(upgradeId: string): boolean {
    const up = this.content.upgrade(upgradeId)
    return !!up && !this.current.upgrades.includes(upgradeId) && this.current.money >= up.cost
  }

  buyUpgrade(upgradeId: string): boolean {
    const up = this.content.upgrade(upgradeId)
    if (!up || !this.canBuyUpgrade(upgradeId)) return false
    this.current.money -= up.cost
    this.current.upgrades.push(upgradeId)
    this.current.stats.upgrades++
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
    this.current.jobs[jobId].startedAt = this.now()
    return true
  }

  canHireManager(jobId: string): boolean {
    const job = this.content.job(jobId)
    const js = this.current.jobs[jobId]
    if (!job || !js) return false
    return js.rank >= this.content.managerRank(jobId) && !js.hasManager && this.current.money >= job.managerCost
  }

  hireManager(jobId: string): boolean {
    const job = this.content.job(jobId)
    if (!job || !this.canHireManager(jobId)) return false
    const js = this.current.jobs[jobId]
    this.current.money -= job.managerCost
    js.hasManager = true
    this.current.stats.hires++
    if (js.startedAt === null) js.startedAt = this.now()
    return true
  }

  updateSettings(patch: Partial<PlayerSettings>): void {
    this.current.settings = { ...this.current.settings, ...patch }
  }

  // MARK: - Время

  /**
   * Догоняет время до `now`: работы с менеджером собирают все завершённые циклы.
   * Интервал режется по моментам истечения перков: на каждой границе бонус меняется, доля цикла сохраняется.
   * `capSeconds` — максимум учитываемого времени (оффлайн-лимит). Возвращает заработанное.
   */
  advance(now: number, capSeconds?: number): number {
    const from = capSeconds === undefined ? -Infinity : now - capSeconds * 1000
    let earned = 0
    const boundaries = [...new Set(this.current.perks.active.map((a) => a.until).filter((u) => u <= now))].sort((a, b) => a - b)
    for (const b of boundaries) {
      if (b > from) earned += this.collectUntil(b, from)
      // перк истёк: тот же момент, но уже без него
      this.changeModifiers(Math.max(b, from), () => {
        this.current.perks.active = this.current.perks.active.filter((a) => a.until > b)
      }, b - 0.5)
    }
    earned += this.collectUntil(now, from)
    this.credit(earned)
    // Следуем за часами и назад: иначе после «назад, потом вперёд» скачок прошёл бы мимо оффлайн-лимита.
    this.current.lastActiveAt = now
    return earned
  }

  /** Сбор завершённых циклов у работ с менеджером до момента `to` (время раньше `from` не считается). */
  private collectUntil(to: number, from: number): number {
    let earned = 0
    const stats = this.stats(to - 0.5)
    for (const job of this.content.jobs) {
      const js = this.current.jobs[job.id]
      if (!js || js.level <= 0 || !js.hasManager) continue
      if (this.atCap(job.id)) continue // на пороге менеджер ждёт повышения
      let start = js.startedAt ?? to
      if (start > to) start = to // часы перевели назад
      start = Math.max(start, from)
      const duration = this.cycleWith(job.id, stats)
      const completed = Math.floor((to - start) / 1000 / duration)
      if (completed > 0 && Number.isFinite(completed)) {
        earned += this.payout(job.id, to - 0.5) * completed
        start += completed * duration * 1000
      }
      js.startedAt = start
    }
    return earned
  }

  /**
   * Смена бонуса скорости в момент `at` (перк включили/истёк, надели вещь): у идущих работ сохраняется доля
   * пройденного цикла, `startedAt` пересчитывается под новую длительность. `beforeAt` — момент для «старого» бонуса.
   */
  private changeModifiers(at: number, mutate: () => void, beforeAt: number = at): void {
    const before = this.stats(beforeAt)
    const fractions = new Map<string, number>()
    for (const job of this.content.jobs) {
      const js = this.current.jobs[job.id]
      if (!js || js.level <= 0 || js.startedAt === null) continue
      const duration = this.cycleWith(job.id, before)
      const elapsed = Math.max(0, (at - js.startedAt) / 1000)
      const managed = js.hasManager && !this.atCap(job.id)
      fractions.set(job.id, managed ? (elapsed % duration) / duration : Math.min(1, elapsed / duration))
    }
    mutate()
    const after = this.stats(at)
    for (const [jobId, fraction] of fractions) {
      this.current.jobs[jobId].startedAt = at - fraction * this.cycleWith(jobId, after) * 1000
    }
  }

  /** Включить перк из рюкзака. Перемотка срабатывает сразу; остальное действует minutes минут. */
  activatePerk(perkId: string): boolean {
    const perk = this.content.perk(perkId)
    const have = this.current.perks.inventory[perkId] ?? 0
    if (!perk || have < 1) return false
    if (have === 1) delete this.current.perks.inventory[perkId]
    else this.current.perks.inventory[perkId] = have - 1
    const now = this.now()
    if (perk.kind === 'rewind') {
      this.rewind(perk.minutes)
      return true
    }
    this.advance(now)
    this.changeModifiers(now, () => this.current.perks.active.push({ id: perkId, until: now + perk.minutes * 60_000 }))
    return true
  }

  /**
   * Перемотка на `minutes` минут с текущими бонусами: работы с менеджером получают доход за всё время,
   * без менеджера (и менеджер на пороге) доходят до «Готово» и ждут тапа. Таймеры перков не тратятся.
   */
  rewind(minutes: number): number {
    const now = this.now()
    this.advance(now)
    let earned = 0
    for (const job of this.content.jobs) {
      const js = this.current.jobs[job.id]
      if (!js || js.level <= 0 || js.startedAt === null) continue
      const duration = this.cycle(job.id, now)
      if (js.hasManager && !this.atCap(job.id)) {
        let start = js.startedAt - minutes * 60_000
        const completed = Math.floor((now - start) / 1000 / duration)
        if (completed > 0 && Number.isFinite(completed)) {
          earned += this.payout(job.id, now) * completed
          start += completed * duration * 1000
        }
        js.startedAt = start
      } else {
        js.startedAt = Math.min(js.startedAt, now - duration * 1000)
      }
    }
    this.credit(earned)
    return earned
  }

  /** Новая вещь — в рюкзак с меткой «новое». Сама не надевается: надевает игрок. */
  grantItem(itemId: string): void {
    if (!this.content.item(itemId) || this.current.items.owned.includes(itemId)) return
    this.current.items.owned.push(itemId)
  }

  /** Надеть свою вещь (вместо той, что в слоте). Скорость меняется на ходу — доля цикла сохраняется. */
  equip(itemId: string): boolean {
    const item = this.content.item(itemId)
    if (!item || !this.current.items.owned.includes(itemId)) return false
    const now = this.now()
    this.advance(now)
    this.changeModifiers(now, () => { this.current.items.equipped[item.slot] = itemId })
    return true
  }

  unequip(slot: Slot): void {
    if (!this.current.items.equipped[slot]) return
    const now = this.now()
    this.advance(now)
    this.changeModifiers(now, () => { delete this.current.items.equipped[slot] })
  }

  /** Сколько даст перемотка, без изменений состояния. */
  rewindPreview(minutes: number): number {
    return new GameEngine(this.content, structuredClone(this.current), this.now).rewind(minutes)
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
    const { settings, ui } = this.current
    this.current = newGame(this.content, now, settings.language)
    this.current.settings = settings
    // Пройденное обучение и просмотренные подсказки не повторяем («и больше никогда»).
    this.current.ui.tutorialDone = ui.tutorialDone
    this.current.ui.tutorialStep = ui.tutorialDone ? ui.tutorialStep : 0
    this.current.ui.hintsSeen = [...ui.hintsSeen]
  }

  /** Подменить состояние целиком (загрузка из облака). */
  replaceState(state: GameState): void {
    this.current = withAllJobs(this.content, state)
    this.startIdleJobs()
  }

  private credit(amount: number): void {
    if (!(amount > 0) || !Number.isFinite(amount)) return
    this.current.money += amount
    this.current.lifetimeEarnings += amount
    this.current.stats.earned += amount
  }
}

/** В сейве есть запись для каждой работы из контента (новые работы в jobs.json, старые сейвы). */
function withAllJobs(content: GameContent, state: GameState): GameState {
  for (const job of content.jobs) {
    state.jobs[job.id] ??= { level: 0, rank: 0, hasManager: false, startedAt: null }
  }
  return state
}
