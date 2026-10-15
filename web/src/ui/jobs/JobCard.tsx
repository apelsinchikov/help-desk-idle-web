import { useState } from 'preact/hooks'
import { iconUrl } from '../../app/icons.ts'
import { t } from '../../app/strings.ts'
import { promotionLabelKey } from '../../core/achievements.ts'
import type { JobDefinition } from '../../core/content.ts'
import { money, useGame } from '../context.ts'
import { Icon } from '../Icon.tsx'
import { LockedJobCard } from './LockedJobCard.tsx'
import { ProgressBar } from './ProgressBar.tsx'

/** Карточка работы: иконка — старт/сбор, вся правая панель — покупка уровней (на пороге — повышение). */
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
          onClick={onIcon}
        >
          <Icon src={iconUrl(job.iconKey)} class="card__icon" />
          {ready && <span class="card__collect">{t('job.collect')}</span>}
        </button>
        <span class="card__level">{Number.isFinite(cap) ? `${level} / ${cap}` : `${level}`}</span>
        {float && <div class="card__float" key={float.id}>{float.text}</div>}
      </div>
      {engine.atCap(job.id) ? <PromotePanel job={job} /> : <BuyPanel job={job} />}
    </div>
  )
}

function BuyPanel({ job }: { job: JobDefinition }) {
  const game = useGame()
  const { engine } = game
  const quote = engine.quote(job.id, game.buyMode.value)
  const canBuy = quote.count > 0 && quote.cost <= engine.state.money
  const onBuy = () => game.act('purchase', () => engine.buy(job.id, game.buyMode.value))
  return (
    <button
      class={`card__panel ${canBuy ? '' : 'card__panel--off'}`}
      data-tutorial={`job-panel:${job.id}`}
      disabled={!canBuy}
      onClick={onBuy}
    >
      <span class="card__title">{t(`job.${job.id}.title`)}</span>
      <ProgressBar jobId={job.id} status={engine.status(job.id)} />
      <span class="card__buy">
        <span>{t('buy.button', Math.max(quote.count, 1))}</span>
        <span>{money(quote.cost)}</span>
      </span>
    </button>
  )
}

function PromotePanel({ job }: { job: JobDefinition }) {
  const game = useGame()
  const { engine } = game
  const cost = engine.promotionCost(job.id)
  const canPay = cost <= engine.state.money
  const cap = engine.cap(job.id)
  const index = engine.content.milestoneLevels(job.id).indexOf(cap)
  const reward = engine.content.milestones.find((m) => m.jobId === job.id && m.level === cap)
  return (
    <button
      class={`card__panel card__panel--promote ${canPay ? '' : 'card__panel--off'}`}
      data-tutorial={`job-panel:${job.id}`}
      disabled={!canPay}
      onClick={() => game.promote(job.id)}
    >
      <span class="card__title">{t(`job.${job.id}.title`)}</span>
      <ProgressBar jobId={job.id} status={engine.status(job.id)} />
      <span class="card__buy">
        <span>{t(promotionLabelKey(index))}</span>
        <span>{money(cost)}</span>
      </span>
      {reward && <span class="card__reward">{t('job.promote.reward', t(`effect.${reward.effect}`), reward.value)}</span>}
    </button>
  )
}
