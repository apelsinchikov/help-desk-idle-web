import { iconUrl } from '../../app/icons.ts'
import { t } from '../../app/strings.ts'
import type { JobDefinition } from '../../core/content.ts'
import { money, useGame } from '../context.ts'
import { Icon } from '../Icon.tsx'

export function LockedJobCard({ job, requirementMet }: { job: JobDefinition; requirementMet: boolean }) {
  const game = useGame()
  const { engine } = game
  const canUnlock = engine.canUnlock(job.id)
  const previous = engine.content.previousJob(job.id)

  const onUnlock = () => {
    game.act('purchase', () => {
      if (engine.unlock(job.id)) game.haptic('success')
    })
  }

  return (
    <div class="card card--locked">
      <div class="card__side">
        <div class="card__icon card__icon--locked">
          <Icon src={iconUrl(job.iconKey)} class="card__icon-img--locked" />
          <Icon src={iconUrl('lock')} class="card__lock" />
        </div>
      </div>
      <div class="card__main">
        <div class="card__title">{t(`job.${job.id}.title`)}</div>
        {previous && (
          <div class="card__req">
            {t('job.locked.requirement', t(`job.${previous.id}.title`), job.unlockLevel)}
            {requirementMet && <span class="card__req-done"> — {t('job.locked.done')}</span>}
          </div>
        )}
        <button class={`unlock ${canUnlock ? '' : 'unlock--off'}`} disabled={!canUnlock} onClick={onUnlock}>
          <span>{t('job.unlock')}</span>
          <span>{money(job.baseCost)}</span>
        </button>
      </div>
    </div>
  )
}
