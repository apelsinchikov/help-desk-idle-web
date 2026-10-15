import { useEffect } from 'preact/hooks'
import { t } from '../app/strings.ts'
import { useGame } from './context.ts'

/** Тост достижения: первый из очереди, 3 секунды. */
export function Toast() {
  const game = useGame()
  const first = game.toasts.value[0]
  useEffect(() => {
    if (!first) return
    const timer = setTimeout(() => game.dismissToast(), 3000)
    return () => clearTimeout(timer)
  }, [first])
  if (!first) return null
  const args = first.args.map((a) => (typeof a === 'string' ? t(a) : a))
  return <div class="toast" onClick={() => game.dismissToast()}>{t(first.key, ...args)}</div>
}
