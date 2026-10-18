// Реорганизация (престиж): TechCoin, статус компании, улучшения и наставники за монеты.
// Формула монет — AdVenture Capitalist (Pecorella, *The Math of Idle Games* Part III): от денег за всё время,
// под корнем — каждый следующий сброс выгоден только при большем заработке (×2 монет ≈ ×4 денег).
import type { CoinUpgradeDefinition, GameContent } from './content.ts'
import type { GameState } from './state.ts'

/** Сколько монет «заработано» за всё время: `⌊coinFactor · √(lifetime / coinScale)⌋`. */
export function coinsTotal(content: GameContent, lifetime: number): number {
  const { coinFactor, coinScale } = content.config.prestige
  if (!(lifetime > 0)) return 0
  return Math.floor(coinFactor * Math.sqrt(lifetime / coinScale))
}

/** Сколько монет даст реорганизация сейчас. */
export function claimable(content: GameContent, state: GameState): number {
  return Math.max(0, coinsTotal(content, state.lifetimeEarnings) - state.coins.claimed)
}

/** Заработок за всё время, с которого появляется монета номер `coins`. */
export function lifetimeFor(content: GameContent, coins: number): number {
  const { coinFactor, coinScale } = content.config.prestige
  return coinScale * (coins / coinFactor) ** 2
}

/**
 * Совет Pecorella: сбрасываться, когда получишь +50…200% к уже имеющимся монетам. Первую реорганизацию советуем
 * с `firstCoins` монет (ощутимые +X% к прибыли), дальше — когда получишь не меньше, чем уже есть на счету.
 */
export function reorgRecommended(content: GameContent, state: GameState, firstCoins = 10): boolean {
  const claim = claimable(content, state)
  return state.coins.claimed === 0 ? claim >= firstCoins : claim >= Math.max(1, state.coins.balance)
}

export type CompanyStatus = {
  /** 0 — «Гаражный стартап», дальше по порогам (до `statuses`). */
  level: number
  /** Монет за все реорганизации нужно для этого статуса и для следующего (null — максимум). */
  from: number
  next: number | null
}

/** Статус компании по монетам, полученным за все реорганизации (траты его не уменьшают). */
export function companyStatus(content: GameContent, claimed: number): CompanyStatus {
  const { statusBase, statusStep, statuses } = content.config.prestige
  const need = (g: number) => statusBase * statusStep ** (g - 1)
  let level = 0
  while (level < statuses && claimed >= need(level + 1)) level++
  return { level, from: level === 0 ? 0 : need(level), next: level < statuses ? need(level + 1) : null }
}

/** Бонус к прибыли за одну монету на счету: база + статус + улучшения «Харизма». */
export function coinBonus(content: GameContent, state: GameState): number {
  const { coinBonus: base, statusBonus } = content.config.prestige
  const extra = owned(content, state).filter((u) => u.kind === 'coinBonus').reduce((s, u) => s + u.value, 0)
  return base + statusBonus * companyStatus(content, state.coins.claimed).level + extra
}

/** Множитель прибыли всех работ от монет на счету и улучшений «×3 всей прибыли» за монеты. */
export function coinProfitMultiplier(content: GameContent, state: GameState): number {
  const fromUpgrades = owned(content, state).filter((u) => u.kind === 'profit').reduce((p, u) => p * u.value, 1)
  return (1 + state.coins.balance * coinBonus(content, state)) * fromUpgrades
}

/** Сколько часов копится оффлайн-доход: базовый лимит или «Ночная смена». */
export function offlineHours(content: GameContent, state: GameState): number {
  return Math.max(content.config.offlineCapHours, ...owned(content, state).filter((u) => u.kind === 'offline').map((u) => u.value))
}

/** Сколько первых работ получают менеджера сразу после реорганизации («Опытная команда»). */
export function keptManagers(content: GameContent, state: GameState): number {
  return Math.max(0, ...owned(content, state).filter((u) => u.kind === 'keepManagers').map((u) => u.value))
}

/** Скидка наставника на уровни работы (0 — наставника нет). */
export function mentorDiscount(content: GameContent, state: GameState, jobId: string): number {
  return state.coins.mentors.includes(jobId) ? content.config.prestige.mentorDiscount : 0
}

/** Улучшение доступно: не куплено, куплена предыдущая ступень. */
export function coinUpgradeOpen(state: GameState, up: CoinUpgradeDefinition): boolean {
  return !state.coins.upgrades.includes(up.id) && (!up.requires || state.coins.upgrades.includes(up.requires))
}

function owned(content: GameContent, state: GameState): CoinUpgradeDefinition[] {
  return state.coins.upgrades.map((id) => content.coinUpgrade(id)).filter((u): u is CoinUpgradeDefinition => !!u)
}
