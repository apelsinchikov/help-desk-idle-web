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
  /** Сколько повышений нужно для найма менеджера (ранг). Нет — `config.managerMinRank`. */
  managerMinRank?: number
  /** Наставник за TechCoin: цена в монетах (скидка на уровни этой работы навсегда). */
  mentorCost: number
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
  managerMinRank: number
  /** Повышение на пороге стоит как столько раз пройденный отрезок уровней (от прошлого порога до этого). */
  promotionFactor: number
  /** Сезон сейвов: сейв прошлого сезона при загрузке начинается заново (вайп). */
  saveSeason: number
  /** Перк-компенсация за вайп (в рюкзак). */
  wipeCompensation: string
  /** Энергетики за рекламу: перк ускорения, минут на банку, сколько банок. */
  energy: { perkId: string; minutesPerCan: number; cans: number }
  /** Потолки скидок (доля). */
  effects: { levelDiscountCap: number; gradeDiscountCap: number }
  /** Сообщения внизу экрана: сколько висит заявка (seconds) и тост (toastSeconds), как часто заявки, сколько их в банке. */
  messages: { seconds: number; toastSeconds: number; ticketEverySeconds: number; tickets: number }
  /**
   * Трек звёзд: перки на perkFirst, perkFirst + perkEvery, … (между вещами); следующая вещь — через itemStars[её редкость] звёзд после прошлой
   * (редкие дороже); перемотка каждые rewindEvery; уровни перков по звёздам.
   */
  track: { perkFirst: number; perkEvery: number; itemStars: Record<Rarity, number>; rewindEvery: number; weights: Record<PerkKind, number>; tiers: TrackTier[] }
  /** Задания: окно времени на цель, замена раз в rerollHours, сколько сборов для «Собери вручную». */
  quests: { minMinutes: number; maxMinutes: number; rerollHours: number; collect: [number, number] }
  /**
   * Реорганизация (престиж, Pecorella Part III — формула AdCap): всего монет `⌊coinFactor · √(lifetime / coinScale)⌋`;
   * каждая монета на счету — `+coinBonus` к прибыли, статус компании g (по монетам за все реорганизации, порог
   * `statusBase · statusStep^(g−1)`) добавляет `statusBonus` за монету; наставник — скидка `mentorDiscount` на уровни работы.
   */
  prestige: {
    coinFactor: number
    coinScale: number
    coinBonus: number
    statusBase: number
    statusStep: number
    statusBonus: number
    statuses: number
    mentorDiscount: number
  }
}

/** Улучшение за TechCoin (навсегда, реорганизация не сбрасывает). `requires` — предыдущая ступень. */
export type CoinUpgradeKind = 'offline' | 'profit' | 'coinBonus' | 'keepManagers'
export type CoinUpgradeDefinition = { id: string; kind: CoinUpgradeKind; value: number; cost: number; requires?: string }

/** Четыре стата бонусов: вещи и перки складываются внутри стата. */
export type StatKey = 'speed' | 'salary' | 'levelDiscount' | 'gradeDiscount'
export type PerkKind = 'speed' | 'salary' | 'levelDiscount' | 'rewind'
/** Перк: `value` — доля (1 = +100%, 0.15 = −15%), у перемотки 0; `minutes` — длительность (у перемотки — сколько мотаем). */
export type PerkDefinition = { id: string; kind: PerkKind; value: number; minutes: number }
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
export type Slot = 'head' | 'glasses' | 'top' | 'pants' | 'shoes' | 'watch' | 'accessory'
export const SLOTS: readonly Slot[] = ['head', 'glasses', 'top', 'pants', 'shoes', 'watch', 'accessory']
export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary']
/** Вещь гардероба: один стат; работает, только когда надета. */
export type ItemDefinition = { id: string; slot: Slot; rarity: Rarity; stat: StatKey; value: number; iconKey: string }
/** Сундук магазина (покупка — этапы 3–4): шансы вещи (одна) и сколько перков уровня `perkTier`. */
export type ChestDefinition = {
  id: string
  currency: 'techcoin' | 'cookies'
  items: { rarity: Rarity; chance: number }[]
  perks: [number, number]
  perkTier: number
  /** Цена в своей валюте (у сундуков за TechCoin); нет — пока не продаётся. */
  price?: number
}
export type TrackTier = {
  fromStars: number
  minutes: number[]
  speed: number[]
  levelDiscount: number[]
  salary: number[]
  rewind: number[]
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
  readonly perks: readonly PerkDefinition[]
  /** В порядке выдачи за звёзды. */
  readonly items: readonly ItemDefinition[]
  readonly chests: readonly ChestDefinition[]
  /** Улучшения за TechCoin в порядке показа. */
  readonly coinUpgrades: readonly CoinUpgradeDefinition[]

  constructor(
    jobs: readonly JobDefinition[],
    milestones: readonly Milestone[],
    config: GameConfig,
    upgrades: readonly UpgradeDefinition[] = [],
    perks: readonly PerkDefinition[] = [],
    items: readonly ItemDefinition[] = [],
    chests: readonly ChestDefinition[] = [],
    coinUpgrades: readonly CoinUpgradeDefinition[] = [],
  ) {
    this.jobs = [...jobs].sort((a, b) => a.order - b.order)
    this.milestones = milestones.map((m) => ({ ...m, jobId: m.jobId ?? null }))
    this.config = config
    this.upgrades = upgrades.map((u) => ({ ...u, jobId: u.jobId ?? null })).sort((a, b) => a.cost - b.cost)
    this.perks = perks
    this.items = items
    this.chests = chests
    this.coinUpgrades = coinUpgrades
  }

  coinUpgrade(id: string): CoinUpgradeDefinition | undefined {
    return this.coinUpgrades.find((u) => u.id === id)
  }

  chest(id: string): ChestDefinition | undefined {
    return this.chests.find((c) => c.id === id)
  }

  perk(id: string): PerkDefinition | undefined {
    return this.perks.find((p) => p.id === id)
  }

  item(id: string): ItemDefinition | undefined {
    return this.items.find((i) => i.id === id)
  }

  upgrade(id: string): UpgradeDefinition | undefined {
    return this.upgrades.find((u) => u.id === id)
  }

  /** Ранг работы, с которого можно нанять её менеджера. */
  managerRank(jobId: string): number {
    return this.job(jobId)?.managerMinRank ?? this.config.managerMinRank
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
