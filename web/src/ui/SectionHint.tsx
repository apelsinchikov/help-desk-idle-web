import { iconUrl } from '../app/icons.ts'
import { t } from '../app/strings.ts'
import { tutorialView } from '../core/progress.ts'
import { useGame } from './context.ts'
import { Icon } from './Icon.tsx'

/** Подсказка раздела при первом входе. Не мешает обучению: пока идёт его шаг — молчит. */
export function SectionHint({ section }: { section: string }) {
  const game = useGame()
  const { engine } = game
  if (engine.state.ui.hintsSeen.includes(section)) return null
  if (tutorialView(engine, game.route.value)) return null
  if (!engine.state.ui.tutorialDone && section === 'managers' && engine.state.ui.tutorialStep >= 6) return null
  return (
    <div class="hint-backdrop">
      <div class="hint">
        <div class="hint__who"><Icon src={iconUrl('avatar')} class="hint__avatar" />{t('hint.speaker')}:</div>
        <p class="hint__text">{t(`hint.${section}`)}</p>
        <button class="hint__ok" onClick={() => game.markHintSeen(section)}>{t('common.gotIt')}</button>
      </div>
    </div>
  )
}
