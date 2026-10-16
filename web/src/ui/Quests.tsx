import { t } from '../app/strings.ts'
import { itemStarSchedule, perkTier } from '../core/track.ts'
import { useGame } from './context.ts'
import { SectionHint } from './SectionHint.tsx'

/** Раздел «Задания»: звёзды и трек наград (пройденные, ближайшие 3, дальше — замок). */
export function Quests() {
  const game = useGame()
  const { engine } = game
  const { content, state } = engine
  const { perkEvery, rewindEvery } = content.config.track
  const itemStars = new Set(itemStarSchedule(content))
  const upcomingItems = content.items.filter((i) => !state.items.owned.includes(i.id))
  const firstNext = (Math.floor(state.track.claimed / perkEvery) + 1) * perkEvery
  const past = [] as number[]
  for (let s = firstNext - perkEvery; s > 0 && past.length < 3; s -= perkEvery) past.unshift(s)
  const next = [firstNext, firstNext + perkEvery, firstNext + 2 * perkEvery]

  // ближайшие награды: вещи идут по порядку, поэтому считаем, какая по счёту достанется на каждой десятке
  let itemIndex = 0
  const rows = next.map((s) => {
    const parts: string[] = []
    if (itemStars.has(s)) {
      const item = upcomingItems[itemIndex++]
      parts.push(item ? t('track.item', t(`item.${item.id}.name`)) : t('track.perk'))
    } else {
      parts.push(t('track.perk'))
    }
    if (s % rewindEvery === 0) parts.push(t('track.rewind', Math.max(...perkTier(content, s).rewind)))
    return { s, text: parts.join(' + ') }
  })

  return (
    <div class="sheet">
      <div class="sheet__head sheet__head--quests">
        <div class="sheet__title-row">
          <h1 class="sheet__title">{t('menu.quests')}</h1>
          <button class="sheet__close" aria-label={t('common.close')} onClick={() => game.navigate('jobs')}>✕</button>
        </div>
        <div class="quests__stars">🎫 {t('quests.closed')}: {state.stars}</div>
      </div>
      <div class="sheet__body">
        <p class="quests__about">{t('track.about')}</p>
        {past.map((s) => (
          <div key={s} class="track track--done"><span class="track__at">✓ {s} 🎫</span><span>{t('track.got')}</span></div>
        ))}
        {rows.map(({ s, text }) => (
          <div key={s} class="track"><span class="track__at">{s} 🎫</span><span>{text}</span></div>
        ))}
        <div class="track track--locked"><span class="track__at">🔒</span><span>{t('track.later')}</span></div>
      </div>
      <SectionHint section="quests" />
    </div>
  )
}
