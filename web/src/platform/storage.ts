// Локальный сейв в localStorage. Порт LocalSaveStore.swift:
// перед записью предыдущая валидная копия становится `hdi.save.prev`;
// битый или «из будущего» сейв не роняет игру — пробуем копию, иначе null (новая игра).
import { decodeState, encodeState } from '../core/serialize.ts'
import type { GameState } from '../core/state.ts'

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/**
 * `account` — пространство имён (Telegram ID): несколько аккаунтов в одном клиенте не делят сейв.
 * Без него — `hdi.save` (браузер вне Telegram).
 */
export function createLocalSave(storage: KeyValueStorage = defaultStorage(), account?: string) {
  const CURRENT = account ? `hdi.${account}.save` : 'hdi.save'
  const BACKUP = `${CURRENT}.prev`

  const read = (key: string): string | null => {
    try {
      return storage.getItem(key)
    } catch {
      return null
    }
  }

  return {
    load(): GameState | null {
      return decodeState(read(CURRENT)) ?? decodeState(read(BACKUP))
    },

    save(state: GameState): void {
      try {
        const previous = read(CURRENT)
        if (previous !== null && decodeState(previous) !== null) storage.setItem(BACKUP, previous)
        storage.setItem(CURRENT, encodeState(state))
      } catch {
        // Хранилище недоступно или переполнено — играем дальше, облако остаётся бэкапом.
      }
    },
  }
}

/** localStorage, если он есть и работает; иначе память (в приватном режиме, в тестах). */
function defaultStorage(): KeyValueStorage {
  try {
    const ls = globalThis.localStorage
    if (ls) {
      ls.getItem('hdi.save')
      return ls
    }
  } catch {
    // нет доступа
  }
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}
