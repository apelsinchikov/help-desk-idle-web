import { useState } from 'preact/hooks'
import { t, uiLanguage } from '../app/strings.ts'
import type { CloudStatus } from '../app/store.ts'
import type { AppLanguage } from '../core/format.ts'
import { useGame } from './context.ts'

export function Settings() {
  const game = useGame()
  const { engine } = game
  const [confirmReset, setConfirmReset] = useState(false)
  const close = () => game.navigate('jobs')

  const setHaptics = (on: boolean) => game.act('purchase', () => engine.updateSettings({ haptics: on }))
  const reset = () => {
    void game.reset()
    setConfirmReset(false)
    close()
  }

  return (
    <div class="sheet">
      <div class="sheet__head">
        <div class="sheet__title-row">
          <h1 class="sheet__title sheet__title--ink">{t('menu.settings')}</h1>
          <button class="sheet__close" aria-label={t('common.close')} onClick={close}>✕</button>
        </div>
      </div>
      <div class="sheet__body">
        <div class="group">
          <div class="row">
            <span>{t('settings.language')}</span>
            <div class="segmented">
              {(['ru', 'en'] as AppLanguage[]).map((lang) => (
                <button
                  key={lang}
                  class={uiLanguage.value === lang ? 'segmented__on' : ''}
                  onClick={() => game.setLanguage(lang)}
                >
                  {lang === 'ru' ? 'Русский' : 'English'}
                </button>
              ))}
            </div>
          </div>
          <div class="row">
            <span>{t('settings.theme')}</span>
            <div class="segmented">
              {(['office', 'night'] as const).map((theme) => (
                <button key={theme} class={engine.state.settings.theme === theme ? 'segmented__on' : ''} onClick={() => game.setTheme(theme)}>
                  {t(`settings.theme.${theme}`)}
                </button>
              ))}
            </div>
          </div>
          <label class="row">
            <span>{t('settings.haptics')}</span>
            <input
              type="checkbox"
              class="switch"
              checked={engine.state.settings.haptics}
              onChange={(e) => setHaptics((e.target as HTMLInputElement).checked)}
            />
          </label>
        </div>
        <div class="group">
          <div class="row">
            <span>{t('settings.cloud')}</span>
            <CloudLabel status={game.cloudStatus.value} />
          </div>
        </div>
        <div class="group">
          {confirmReset ? (
            <div class="confirm">
              <div class="confirm__title">{t('settings.reset.title')}</div>
              <div class="confirm__text">{t('settings.reset.message')}</div>
              <div class="confirm__buttons">
                <button class="confirm__cancel" onClick={() => setConfirmReset(false)}>{t('common.cancel')}</button>
                <button class="confirm__ok" onClick={reset}>{t('settings.reset.ok')}</button>
              </div>
            </div>
          ) : (
            <button class="row row--danger" onClick={() => setConfirmReset(true)}>{t('settings.reset')}</button>
          )}
        </div>
        {/* Техническая кнопка тестовой сборки, не переводится. */}
        {game.devBuild && (
          <div class="group">
            <button class="row" onClick={() => game.devGrant()}>DEV: выдать перки и вещь</button>
          </div>
        )}
      </div>
    </div>
  )
}

function CloudLabel({ status }: { status: CloudStatus }) {
  switch (status.kind) {
    case 'disabled':
      return <span class="muted">{t('cloud.telegramOnly')}</span>
    case 'syncing':
      return <span class="muted">{t('cloud.syncing')}</span>
    case 'offline':
      return <span class="danger">{t('cloud.offline')}</span>
    case 'synced': {
      const time = new Intl.DateTimeFormat(uiLanguage.value, { hour: '2-digit', minute: '2-digit' }).format(status.at)
      return <span class="positive">{t('cloud.synced', time)}</span>
    }
  }
}
