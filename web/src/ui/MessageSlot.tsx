import { useEffect } from 'preact/hooks'
import { t } from '../app/strings.ts'
import type { Message } from '../core/messages.ts'
import { money, useGame } from './context.ts'

/** Одно сообщение внизу экрана: первое из очереди, `config.messages.seconds` секунд, тап — скрыть. */
export function MessageSlot() {
  const game = useGame()
  const first = game.messages.value[0]
  const seconds = game.engine.content.config.messages.seconds
  useEffect(() => {
    if (!first) return
    const timer = setTimeout(() => game.dismissMessage(), seconds * 1000)
    return () => clearTimeout(timer)
  }, [first])
  if (!first) return null
  return (
    <div class={`message message--${first.kind}`} onClick={() => game.dismissMessage()}>
      {text(first)}
    </div>
  )
}

function text(m: Message): string {
  if (m.kind === 'ticket') {
    const n = m.index + 1
    return t('ticket.from', t(`ticket.${n}.dept`), t(`ticket.${n}.text`))
  }
  const args = m.text.args.map((a) => (typeof a === 'string' ? t(a) : typeof a === 'number' ? a : money(a.money)))
  return t(m.text.key, ...args)
}
