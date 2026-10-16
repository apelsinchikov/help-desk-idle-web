import { useState } from 'preact/hooks'
import { iconUrl } from '../app/icons.ts'
import { t } from '../app/strings.ts'
import { rewardsOf } from '../core/achievements.ts'
import type { Milestone } from '../core/content.ts'
import { useGame } from './context.ts'
import { Icon } from './Icon.tsx'
import { rewardText } from './labels.ts'
import { SectionHint } from './SectionHint.tsx'


export function Achievements() {
  const game = useGame()
  const [tab, setTab] = useState<'goals' | 'gallery'>('goals')
  return (
    <div class="sheet">
      <div class="sheet__head sheet__head--achievements">
        <div class="sheet__title-row">
          <h1 class="sheet__title">{t('menu.achievements')}</h1>
          <button class="sheet__close" aria-label={t('common.close')} onClick={() => game.navigate('jobs')}>✕</button>
        </div>
        <div class="tabs">
          {(['goals', 'gallery'] as const).map((k) => (
            <button key={k} class={tab === k ? 'tabs__active tabs__active--achievements' : 'tabs__off'} onClick={() => setTab(k)}>
              {t(`ach.tab.${k}`)}
            </button>
          ))}
        </div>
      </div>
      <div class="sheet__body">{tab === 'goals' ? <Goals /> : <Gallery />}</div>
      <SectionHint section="achievements" />
    </div>
  )
}

/** Цели: по каждой открытой работе — следующий порог и прогресс уровня к нему. */
function Goals() {
  const { engine } = useGame()
  return (
    <>
      {engine.content.jobs.filter((j) => engine.level(j.id) > 0).map((job) => {
        const next = engine.nextMilestone(job.id)
        const level = engine.level(job.id)
        return (
          <div class="manager" key={job.id}>
            <Icon src={iconUrl(job.iconKey)} class="manager__icon" />
            <div class="manager__info">
              <div class="manager__name">{t(`job.${job.id}.title`)}</div>
              {next ? (
                <>
                  <div class="manager__runs">{t('ach.goal.next', next.level, rewardText(rewardsOf(engine.content.milestones.filter((m) => m.jobId === job.id && m.level === next.level))))}</div>
                  <div class="goal__track"><div class="goal__fill" style={{ width: `${Math.min(1, level / next.level) * 100}%` }} /></div>
                </>
              ) : (
                <div class="manager__runs">{t('ach.goal.done')}</div>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}

/** Галерея: все пороги с наградами; полученные — яркие, ещё не полученные — бледные. */
function Gallery() {
  const { engine } = useGame()
  const groups: { title: string; icon: string; list: Milestone[]; rank: number }[] = engine.content.jobs.map((job) => ({
    title: t(`job.${job.id}.title`),
    icon: iconUrl(job.iconKey),
    list: engine.content.milestones.filter((m) => m.jobId === job.id),
    rank: engine.rank(job.id),
  }))
  const lowest = Math.min(...engine.content.jobs.map((j) => engine.rank(j.id)))
  groups.push({ title: t('ach.all.title'), icon: '', list: engine.content.milestones.filter((m) => m.jobId === null), rank: lowest })
  return (
    <>
      {groups.map((g) => {
        return (
          <div class="gallery" key={g.title}>
            <div class="gallery__title">{g.icon && <Icon src={g.icon} class="gallery__icon" />}{g.title}</div>
            <div class="gallery__grid">
              {g.list.map((m) => (
                <div key={`${m.level}-${m.effect}`} class={`gallery__item ${m.level <= g.rank ? 'gallery__item--got' : 'gallery__item--todo'}`}>
                  <b>{m.level}</b><small>{rewardText(rewardsOf([m]))}</small>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
}
