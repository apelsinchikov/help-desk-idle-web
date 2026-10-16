import { useState } from 'preact/hooks'
import { t } from '../app/strings.ts'
import { questProgress } from '../core/quests.ts'
import type { Quest } from '../core/state.ts'
import type { GameEngine } from '../core/engine.ts'
import { money, timer, useGame } from './context.ts'

/** Текст задания: «Прокачай «Воткнуть мышку» до ур. 50». */
export function questText(engine: GameEngine, q: Quest): string {
  const job = q.jobId ? t(`job.${q.jobId}.title`) : ''
  switch (q.kind) {
    case 'level': return t('quest.level', job, q.target)
    case 'promote': return t('quest.promote', job)
    case 'earn': return t('quest.earn', money(q.target))
    case 'collect': return t('quest.collect', q.target)
    case 'unlock': return t('quest.unlock', job)
    default: return t(`quest.${q.kind}`)
  }
}

function progressText(engine: GameEngine, q: Quest): string {
  const p = questProgress(engine, q)
  if (q.kind === 'earn') return `${money(Math.max(0, p.value))} / ${money(p.target)}`
  if (q.kind === 'level' || q.kind === 'collect') return `${Math.max(0, p.value)} / ${p.target}`
  return ''
}

/** Задания под шапкой: три квадрата в строку с прогрессом; тап — под строкой полный текст и «Заменить». */
export function QuestStrip() {
  const game = useGame()
  const { engine } = game
  const [open, setOpen] = useState<number | null>(null)
  const quests = engine.state.quests.active
  if (quests.length === 0) return null
  const selected = quests.find((q) => q.id === open)
  const rerollIn = (engine.state.quests.rerollAt - game.now()) / 1000
  return (
    <div class="quests">
      <div class="quests__row">
        {quests.map((q) => {
          const p = questProgress(engine, q)
          const share = Math.max(0, Math.min(1, p.value / p.target))
          return (
            <button key={q.id} class={`quest ${open === q.id ? 'quest--open' : ''}`} onClick={() => setOpen(open === q.id ? null : q.id)}>
              <span class="quest__text">{questText(engine, q)}</span>
              <span class="quest__progress">{progressText(engine, q)}</span>
              <span class="quest__bar" style={{ width: `${share * 100}%` }} />
            </button>
          )
        })}
      </div>
      {selected && (
        <div class="quest__details">
          <span><span class="quest__full">{questText(engine, selected)}</span> · {t('quest.reward')}</span>
          {rerollIn > 0
            ? <span class="quest__wait">{t('quest.rerollIn', timer(rerollIn))}</span>
            : <button class="quest__reroll" onClick={() => { game.rerollQuest(selected.id); setOpen(null) }}>{t('quest.reroll')}</button>}
        </div>
      )}
    </div>
  )
}
