// Вещи гардероба: какая выдаётся следующей за звёзды и что изменится, если надеть.
import type { GameContent, ItemDefinition, StatKey } from './content.ts'
import { itemTotals } from './modifiers.ts'
import type { GameState } from './state.ts'

const STATS: StatKey[] = ['speed', 'salary', 'levelDiscount', 'gradeDiscount']

/** Следующая вещь трека: первая из items.json, которой ещё нет. */
export function nextItem(content: GameContent, state: GameState): ItemDefinition | null {
  return content.items.find((i) => !state.items.owned.includes(i.id)) ?? null
}

export type CompareRow = { stat: StatKey; before: number; after: number; verdict: 'better' | 'worse' | 'same' }

/**
 * Сравнение «было → станет» по статам вещей, если надеть `itemId` вместо того, что в её слоте.
 * Строки — статы, которые есть до или после; `removes` — вещь, которая снимется. Больше — всегда лучше (скидки тоже).
 */
export function compareEquip(content: GameContent, state: GameState, itemId: string): { rows: CompareRow[]; removes: string | null } {
  const item = content.item(itemId)
  if (!item) return { rows: [], removes: null }
  const before = itemTotals(content, state)
  const current = state.items.equipped[item.slot] ?? null
  const trial: GameState = { ...state, items: { ...state.items, equipped: { ...state.items.equipped, [item.slot]: itemId } } }
  const after = itemTotals(content, trial)
  const rows: CompareRow[] = []
  for (const stat of STATS) {
    const b = round(before[stat])
    const a = round(after[stat])
    if (b === 0 && a === 0) continue
    rows.push({ stat, before: b, after: a, verdict: a > b ? 'better' : a < b ? 'worse' : 'same' })
  }
  return { rows, removes: current === itemId ? null : current }
}

const round = (v: number) => Math.round(v * 1e6) / 1e6

/** Игрок увидел вещи (открыл вкладку «Вещи» рюкзака или гардероб): метки «новое» и точка на «Меню» гаснут. */
export function markItemsSeen(state: GameState): void {
  for (const id of state.items.owned) if (!state.items.seen.includes(id)) state.items.seen.push(id)
}
