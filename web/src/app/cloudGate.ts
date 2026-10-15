// Защита облачного сейва: ничего не выгружаем, пока не скачали облако и не выбрали лучший сейв.
// Иначе новый/очищенный клиент при медленной сети затёр бы облачный прогресс пустой игрой.
import { pickSave } from '../core/savePicker.ts'
import type { GameState } from '../core/state.ts'

/** none — строки нет; ok — сейв прочитан; unreadable — строка есть, но битая или из будущей версии. */
export type RemoteSave = { kind: 'none' } | { kind: 'ok'; state: GameState } | { kind: 'unreadable' }

export type CloudGate = {
  /** Скачать облако и принять его, если там прогресс больше. Повторные вызовы ждут тот же запрос. */
  reconcile(): Promise<void>
  /** Выгрузить текущее состояние (сначала reconcile, если ещё не было). */
  upload(): Promise<void>
}

export function createCloudGate(o: {
  cloud: { download(): Promise<RemoteSave>; upload(state: GameState): Promise<void> }
  current: () => GameState
  adopt: (state: GameState) => void
}): CloudGate {
  let reconciled = false
  let blocked = false
  let inFlight: Promise<void> | null = null

  const reconcile = (): Promise<void> => {
    if (blocked) return Promise.reject(new Error('remote_unreadable'))
    if (reconciled) return Promise.resolve()
    inFlight ??= (async () => {
      try {
        const remote = await o.cloud.download()
        if (remote.kind === 'unreadable') {
          blocked = true
          throw new Error('remote_unreadable')
        }
        if (remote.kind === 'ok') {
          const local = o.current()
          if (pickSave(local, remote.state) !== local) o.adopt(remote.state)
        }
        reconciled = true
      } finally {
        inFlight = null
      }
    })()
    return inFlight
  }

  return {
    reconcile,
    async upload() {
      await reconcile()
      await o.cloud.upload(o.current())
    },
  }
}
