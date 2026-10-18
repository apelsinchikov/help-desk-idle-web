import { iconUrl } from '../app/icons.ts'
import { t } from '../app/strings.ts'
import type { JobDefinition } from '../core/content.ts'
import { money, useGame } from './context.ts'
import { Icon } from './Icon.tsx'
import { coins } from './Reorg.tsx'
import { SectionHint } from './SectionHint.tsx'
import { CoinBalance, CoinTabs } from './Upgrades.tsx'

/** Менеджеры: за деньги (автосбор, до реорганизации) и наставники за TechCoin (скидка на уровни навсегда). */
export function Managers() {
  const game = useGame()
  const { engine } = game
  const coinsOpen = engine.state.ui.sections.includes('reorg')
  const tab = coinsOpen ? game.coinTab.value : 'cash'
  return (
    <div class="sheet">
      <div class="sheet__head sheet__head--managers">
        <div class="sheet__title-row">
          <h1 class="sheet__title">{t('menu.managers')}</h1>
          <button class="sheet__close" aria-label={t('common.close')} onClick={() => game.navigate('jobs')}>✕</button>
        </div>
        <CoinTabs active="managers" open={coinsOpen} />
      </div>
      <div class="sheet__body">{tab === 'cash' ? <CashManagers /> : <Mentors />}</div>
      <SectionHint section="managers" />
    </div>
  )
}

function CashManagers() {
  const { engine } = useGame()
  const hired = (j: JobDefinition) => engine.state.jobs[j.id]?.hasManager ?? false
  return (
    <>
      <div class="managers__balance">
        <span>{t('managers.balance')}</span>
        <span>{money(engine.state.money)}</span>
      </div>
      <p class="managers__intro">{t('managers.intro')}</p>
      {engine.content.jobs.filter((j) => !hired(j)).map((job) => <ManagerRow key={job.id} job={job} />)}
      {engine.content.jobs.some(hired) && <div class="group__title">{t('managers.hired')}</div>}
      {engine.content.jobs.filter(hired).map((job) => <ManagerRow key={job.id} job={job} />)}
    </>
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
  const minRank = engine.content.managerRank(job.id)
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
        <span class="manager__locked">{t('managers.needRank', minRank, level)}</span>
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

function Mentors() {
  const { engine } = useGame()
  const has = (j: JobDefinition) => engine.state.coins.mentors.includes(j.id)
  return (
    <>
      <CoinBalance />
      <p class="managers__intro">{t('mentor.intro', Math.round(engine.content.config.prestige.mentorDiscount * 100))}</p>
      {engine.content.jobs.filter((j) => !has(j)).map((job) => <MentorRow key={job.id} job={job} />)}
      {engine.content.jobs.some(has) && <div class="group__title">{t('managers.hired')}</div>}
      {engine.content.jobs.filter(has).map((job) => <MentorRow key={job.id} job={job} />)}
    </>
  )
}

function MentorRow({ job }: { job: JobDefinition }) {
  const game = useGame()
  const { engine } = game
  const hired = engine.state.coins.mentors.includes(job.id)
  const can = engine.canHireMentor(job.id)
  return (
    <div class="manager">
      <Icon src={iconUrl(job.iconKey)} class="manager__icon" />
      <div class="manager__info">
        <div class="manager__name">{t('mentor.name', t(`job.${job.id}.title`))}</div>
        <div class="manager__runs">{t('mentor.effect', Math.round(engine.content.config.prestige.mentorDiscount * 100))}</div>
        {!hired && <div class="manager__cost">{t('coins.cost', coins(job.mentorCost))}</div>}
      </div>
      {hired ? (
        <span class="manager__working">{t('managers.working')}</span>
      ) : (
        <button class={`manager__hire manager__hire--reorg ${can ? '' : 'manager__hire--off'}`} disabled={!can} onClick={() => game.hireMentor(job.id)}>
          {t('managers.hire')}
        </button>
      )}
    </div>
  )
}
