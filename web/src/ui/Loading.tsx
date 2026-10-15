import { useState } from 'preact/hooks'
import { iconUrl } from '../app/icons.ts'
import { t } from '../app/strings.ts'
import { Icon } from './Icon.tsx'

export function Loading() {
  const [status] = useState(() => 1 + Math.floor(Math.random() * 5))
  return (
    <div class="loading">
      <div class="loading__logo">
        <div>HELP DESK</div>
        <div class="loading__idle">IDLE</div>
      </div>
      <div class="loading__tagline">{t('loading.tagline')}</div>
      <Icon src={iconUrl('avatar')} class="loading__avatar" />
      <div class="loading__bottom">
        <div class="loading__status">{t(`loading.status.${status}`)}</div>
        <div class="loading__track"><div class="loading__fill" /></div>
      </div>
    </div>
  )
}
