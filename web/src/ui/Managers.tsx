import { iconUrl } from '../app/icons.ts'
import { t } from '../app/strings.ts'
import type { JobDefinition } from '../core/content.ts'
import { money, useGame } from './context.ts'
import { Icon } from './Icon.tsx'
import { SectionHint } from './SectionHint.tsx'

export function Managers() {
  const game = useGame()
  const { engine } = game
  return (
    <div class="sheet">
      <div class="sheet__head sheet__head--managers">
        <div class="sheet__title-row">
          <h1 class="sheet__title">{t('menu.managers')}</h1>
          <button class="sheet__close" aria-label={t('common.close')} onClick={() => game.navigate('jobs')}>✕</button>
        </div>
        <div class="tabs">
          <span class="tabs__active">{t('managers.tab.cash')}</span>
          <span class="tabs__off">{t('managers.tab.coins')} · {t('common.soon')}</span>
        </div>
      </div>
      <div class="sheet__body">
        <div class="managers__balance">
          <span>{t('managers.balance')}</span>
          <span>{money(engine.state.money)}</span>
        </div>
        <p class="managers__intro">{t('managers.intro')}</p>
        {engine.content.jobs.map((job) => <ManagerRow key={job.id} job={job} />)}
      </div>
      <SectionHint section="managers" />
    </div>
  )
}

function ManagerRow({ job }: { job: JobDefinition }) {
  const game = useGame()
  const { engine } = game
  const js = engine.state.jobs[job.id]
  const hired = js?.hasManager ?? false
  const level = js?.level ?? 0
  const rank = js?.rank ?? 0
  const open = level > 0
  const minRank = engine.content.config.managerMinRank
  const canHire = engine.canHireManager(job.id)

  const hire = () => game.act('purchase', () => {
    if (engine.hireManager(job.id)) game.haptic('success')
  })

  return (
    <div class="manager">
      <Icon src={iconUrl(job.iconKey)} class="manager__icon" />
      <div class="manager__info">
        <div class="manager__name">{t(`manager.${job.id}.name`)}</div>
        <div class="manager__runs">{t('managers.runs', t(`job.${job.id}.title`))}</div>
        {!hired && <div class="manager__cost">{money(job.managerCost)}</div>}
      </div>
      {hired ? (
        <span class="manager__working">{t('managers.working')}</span>
      ) : !open ? (
        <span class="manager__locked">{t('managers.lockedJob')}</span>
      ) : rank < minRank ? (
        <span class="manager__locked">{t('managers.needRank', minRank, rank)}</span>
      ) : (
        <button
          class={`manager__hire ${canHire ? '' : 'manager__hire--off'}`}
          data-tutorial={`manager-hire:${job.id}`}
          disabled={!canHire}
          onClick={hire}
        >
          {t('managers.hire')}
        </button>
      )}
    </div>
  )
}
