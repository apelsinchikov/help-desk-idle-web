// Формулы из «The Math of Idle Games, Part I» (Pecorella). См. docs/ECONOMY.md.
// Порт Economy.swift 1:1.

/** cost_next = b · r^k */
export function nextCost(base: number, rate: number, owned: number): number {
  return base * Math.pow(rate, owned)
}

/** cost(n) = b · r^k · (r^n − 1) / (r − 1) */
export function bulkCost(base: number, rate: number, owned: number, count: number): number {
  if (count <= 0) return 0
  if (count === 1) return nextCost(base, rate, owned)
  if (rate === 1) return base * count
  return (nextCost(base, rate, owned) * (Math.pow(rate, count) - 1)) / (rate - 1)
}

/**
 * max = floor( log( c·(r−1) / (b·r^k) + 1 ) / log(r) ), с поправкой на погрешность double:
 * гарантирует bulkCost(max) ≤ money.
 */
export function maxAffordable(base: number, rate: number, owned: number, money: number): number {
  if (!(money > 0) || !(base > 0) || !(rate > 1) || !Number.isFinite(money)) return 0
  const first = nextCost(base, rate, owned)
  if (!Number.isFinite(first) || first > money) return 0

  const raw = Math.floor(Math.log((money * (rate - 1)) / first + 1) / Math.log(rate))
  let n = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 1_000_000) : 1

  const fits = (count: number) => bulkCost(base, rate, owned, count) <= money
  // Погрешность формулы — максимум на одну-две единицы.
  for (let i = 0; i < 3 && n > 0 && !fits(n); i++) n -= 1
  for (let i = 0; i < 3 && fits(n + 1); i++) n += 1
  // Страховка от переполнения: делим пополам, пока не влезет.
  while (n > 0 && !fits(n)) n = Math.floor(n / 2)
  return n
}

/** Выплата за цикл: revenue · level · M */
export function payout(revenue: number, level: number, profitMultiplier: number): number {
  return revenue * level * profitMultiplier
}

/** Длительность цикла в секундах: time / S */
export function cycle(time: number, speedMultiplier: number): number {
  return time / Math.max(speedMultiplier, Number.MIN_VALUE)
}
