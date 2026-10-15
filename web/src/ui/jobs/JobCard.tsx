import { useState } from 'preact/hooks'
import { iconUrl } from '../../app/icons.ts'
import { t } from '../../app/strings.ts'
import { promotionLabelKey } from '../../core/achievements.ts'
import type { JobDefinition } from '../../core/content.ts'
import { money, useGame } from '../context.ts'
import { Icon } from '../Icon.tsx'
import { LockedJobCard } from './LockedJobCard.tsx'
import { ProgressBar, TimeBox } from './ProgressBar.tsx'

/**
 * Карточка работы (по образцу AdCap): иконка с уровнем — старт/сбор; справа название, полоса работы с суммой,
 * под ней кнопка покупки уровней (на пороге — повышение) и блок с оставшимся временем.
 */
export function JobCard({ job }: { job: JobDefinition }) {
  const game = useGame()
  const { engine } = game
  const status = engine.status(job.id)
  const [float, setFloat] = useState<{ text: string; id: number } | null>(null)

  if (status.kind === 'locked') return <LockedJobCard job={job} requirementMet={status.requirementMet} />

  const level = engine.level(job.id)
  const cap = engine.cap(job.id)
  const ready = status.kind === 'ready'

  const onIcon = () => {
    const before = engine.state.money
    game.act('tap', () => engine.tap(job.id))
    if (ready) {
      game.haptic('light')
      const id = Date.now()
      setFloat({ text: '+' + money(engine.state.money - before), id })
      setTimeout(() => setFloat((f) => (f?.id === id ? null : f)), 1000)
    }
  }

  return (
    <div class={`card ${ready ? 'card--ready' : ''}`}>
      <div class="card__side">
        <button
          class={`card__icon-btn ${ready ? 'card__icon-btn--ready' : ''}`}
          data-tutorial={`job-icon:${job.id}`}
          aria-label={t(`job.${job.id}.title`)}
          onClick={onIcon}
        >
          <Icon src={iconUrl(job.iconKey)} class="card__icon" />
          {ready && <span class="card__collect">{t('job.collect')}</span>}
        </button>
        <span class="card__level">{Number.isFinite(cap) ? `${level} / ${cap}` : `${level}`}</span>
        {float && <div class="card__float" key={float.id}>{float.text}</div>}
      </div>
      <div class="card__main">
        <div class="card__title">{t(`job.${job.id}.title`)}</div>
        <ProgressBar jobId={job.id} status={status} />
        {engine.managerWaiting(job.id) && <div class="card__waiting">{t('job.managerWaiting')}</div>}
        <div class="card__row">
          {engine.atCap(job.id) ? <PromoteButton job={job} /> : <BuyButton job={job} />}
          <TimeBox jobId={job.id} status={status} />
        </div>
      </div>
    </div>
  )
}

function BuyButton({ job }: { job: JobDefinition }) {
  const game = useGame()
  const { engine } = game
  const quote = engine.quote(job.id, game.buyMode.value)
  const can = quote.count > 0 && quote.cost <= engine.state.money
  return (
    <button
      class={`card__action ${can ? '' : 'card__action--off'}`}
      data-tutorial={`job-panel:${job.id}`}
      disabled={!can}
      onClick={() => game.act('purchase', () => engine.buy(job.id, game.buyMode.value))}
    >
      <span class="card__action-label">{t('buy.button', Math.max(quote.count, 1))}</span>
      <span class="card__action-price">{money(quote.cost)}</span>
    </button>
  )
}

function PromoteButton({ job }: { job: JobDefinition }) {
  const game = useGame()
  const { engine } = game
  const cost = engine.promotionCost(job.id)
  const can = cost <= engine.state.money
  const index = engine.content.milestoneLevels(job.id).indexOf(engine.cap(job.id))
  return (
    <button
      class={`card__action card__action--promote ${can ? '' : 'card__action--off'}`}
      data-tutorial={`job-panel:${job.id}`}
      disabled={!can}
      onClick={() => game.promote(job.id)}
    >
      <span class="card__action-label">{t(promotionLabelKey(index))}</span>
      <span class="card__action-price">{money(cost)}</span>
    </button>
  )
}
