import { useState } from 'preact/hooks'
import { iconUrl } from '../../app/icons.ts'
import { t } from '../../app/strings.ts'
import type { JobDefinition } from '../../core/content.ts'
import { money, useGame } from '../context.ts'
import { Icon } from '../Icon.tsx'
import { LockedJobCard } from './LockedJobCard.tsx'
import { ProgressBar } from './ProgressBar.tsx'

/** Карточка работы. Вся карточка — зона тапа (старт / сбор). */
export function JobCard({ job }: { job: JobDefinition }) {
  const game = useGame()
  const { engine } = game
  const status = engine.status(job.id)
  const [float, setFloat] = useState<{ text: string; id: number } | null>(null)

  if (status.kind === 'locked') return <LockedJobCard job={job} requirementMet={status.requirementMet} />

  const level = engine.level(job.id)
  const next = engine.nextMilestone(job.id)
  const quote = engine.quote(job.id, game.buyMode.value)
  const canBuy = quote.count > 0 && quote.cost <= engine.state.money

  const onTap = () => {
    const wasReady = status.kind === 'ready'
    const before = engine.state.money
    game.act('tap', () => engine.tap(job.id))
    if (wasReady) {
      game.haptic('light')
      const id = Date.now()
      setFloat({ text: '+' + money(engine.state.money - before), id })
      setTimeout(() => setFloat((f) => (f?.id === id ? null : f)), 1000)
    }
  }

  const onBuy = (e: Event) => {
    e.stopPropagation()
    game.act('purchase', () => engine.buy(job.id, game.buyMode.value))
  }

  return (
    <div class={`card ${status.kind === 'ready' ? 'card--ready' : ''}`} role="button" onClick={onTap}>
      <div class="card__side">
        <Icon src={iconUrl(job.iconKey)} class="card__icon" />
        <span class="card__level">{next ? `${level} / ${next.level}` : `${level}`}</span>
      </div>
      <div class="card__main">
        <div class="card__title">{t(`job.${job.id}.title`)}</div>
        <ProgressBar jobId={job.id} status={status} />
        <button class={`buy ${canBuy ? '' : 'buy--off'}`} disabled={!canBuy} onClick={onBuy}>
          <span>{t('buy.button', Math.max(quote.count, 1))}</span>
          <span>{money(quote.cost)}</span>
        </button>
      </div>
      {float && <div class="card__float" key={float.id}>{float.text}</div>}
    </div>
  )
}
