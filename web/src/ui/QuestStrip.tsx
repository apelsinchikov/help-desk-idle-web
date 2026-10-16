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

/** Полоса заданий под шапкой: три строки с прогрессом; тап — раскрыть с кнопкой «Заменить». */
export function QuestStrip() {
  const game = useGame()
  const { engine } = game
  const [open, setOpen] = useState<number | null>(null)
  const quests = engine.state.quests.active
  if (quests.length === 0) return null
  const rerollIn = (engine.state.quests.rerollAt - Date.now()) / 1000
  return (
    <div class="quests">
      {quests.map((q) => {
        const p = questProgress(engine, q)
        const share = Math.max(0, Math.min(1, p.value / p.target))
        const expanded = open === q.id
        return (
          <div key={q.id} class={`quest ${expanded ? 'quest--open' : ''}`}>
            <button class="quest__row" onClick={() => setOpen(expanded ? null : q.id)}>
              <span class="quest__text">{questText(engine, q)}</span>
              <span class="quest__progress">{progressText(engine, q)}</span>
              <span class="quest__bar" style={{ width: `${share * 100}%` }} />
            </button>
            {expanded && (
              <div class="quest__details">
                <span>{t('quest.reward')}</span>
                {rerollIn > 0
                  ? <span class="quest__wait">{t('quest.rerollIn', timer(rerollIn))}</span>
                  : <button class="quest__reroll" onClick={() => { game.rerollQuest(q.id); setOpen(null) }}>{t('quest.reroll')}</button>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
