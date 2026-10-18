import { useState } from 'preact/hooks'
import { iconUrl } from '../app/icons.ts'
import { t, uiLanguage } from '../app/strings.ts'
import { formatMultiplier } from '../core/format.ts'
import { claimable, coinBonus, coinProfitMultiplier, companyStatus, lifetimeFor, reorgRecommended } from '../core/prestige.ts'
import { money, useGame } from './context.ts'
import { Icon } from './Icon.tsx'
import { SectionHint } from './SectionHint.tsx'

const pct = (v: number) => `${(v * 100).toLocaleString(uiLanguage.value === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: 1 })}%`
export const coins = (n: number) => Math.floor(n).toLocaleString(uiLanguage.value === 'ru' ? 'ru-RU' : 'en-US')
const mult = (v: number) => formatMultiplier(v, uiLanguage.value)

/** «Реорганизация»: монеты на счету и их бонус, статус компании, сколько даст сброс, совет и кнопка. */
export function Reorg() {
  const game = useGame()
  const { engine } = game
  const { content, state } = engine
  const [confirm, setConfirm] = useState(false)
  const claim = claimable(content, state)
  const bonus = coinBonus(content, state)
  const now = coinProfitMultiplier(content, state)
  const after = coinProfitMultiplier(content, { ...state, coins: { ...state.coins, balance: state.coins.balance + claim, claimed: state.coins.claimed + claim } })
  const status = companyStatus(content, state.coins.claimed)
  const progress = status.next === null ? 1 : (state.coins.claimed - status.from) / (status.next - status.from)
  const advice = claim < 1
    ? t('reorg.nothing', money(lifetimeFor(content, state.coins.claimed + 1)))
    : reorgRecommended(content, state)
      ? t('reorg.advice.go')
      : state.coins.claimed === 0 ? t('reorg.advice.first') : t('reorg.advice.more', coins(Math.ceil(state.coins.balance / 2)))

  return (
    <div class="sheet">
      <div class="sheet__head sheet__head--reorg">
        <div class="sheet__title-row">
          <h1 class="sheet__title">{t('menu.reorg')}</h1>
          <button class="sheet__close" aria-label={t('common.close')} onClick={() => game.navigate('jobs')}>✕</button>
        </div>
      </div>
      <div class="sheet__body">
        <div class="reorg__card">
          <Icon src={iconUrl('techcoin')} class="reorg__coin" />
          <div class="reorg__info">
            <div class="reorg__label">{t('reorg.coins')}</div>
            <div class="reorg__value">{coins(state.coins.balance)}</div>
            <div class="reorg__sub">{t('reorg.bonus', pct(state.coins.balance * bonus), pct(bonus))}</div>
          </div>
        </div>

        <div class="reorg__card reorg__card--column">
          <div class="reorg__label">{t('reorg.status.title')}</div>
          <div class="reorg__status">{t(`reorg.status.${status.level}`)}</div>
          <div class="goal__track"><div class="goal__fill goal__fill--reorg" style={{ width: `${Math.min(1, progress) * 100}%` }} /></div>
          <div class="reorg__sub">
            {status.next === null
              ? t('reorg.status.max')
              : t('reorg.status.next', t(`reorg.status.${status.level + 1}`), coins(status.next - state.coins.claimed))}
          </div>
        </div>

        <div class="reorg__card reorg__card--column">
          <div class="reorg__label">{t('reorg.claim.title')}</div>
          <div class="reorg__value reorg__value--claim">+{coins(claim)} TechCoin</div>
          {claim >= 1 && <div class="reorg__sub">{t('reorg.claim.after', mult(after), mult(now))}</div>}
          <p class={`reorg__advice ${claim >= 1 && reorgRecommended(content, state) ? 'reorg__advice--go' : ''}`}>{advice}</p>
          <button class="reorg__button" disabled={claim < 1} onClick={() => setConfirm(true)}>{t('reorg.button')}</button>
        </div>

        <p class="reorg__where">{t('reorg.where')}</p>
      </div>
      {confirm && (
        <div class="overlay" onClick={() => setConfirm(false)}>
          <div class="confirm confirm--modal" onClick={(e) => e.stopPropagation()}>
            <div class="confirm__title">{t('reorg.confirm.title')}</div>
            <p class="confirm__text">{t('reorg.confirm.lose')}</p>
            <p class="confirm__text">{t('reorg.confirm.keep')}</p>
            <div class="confirm__buttons">
              <button class="confirm__cancel" onClick={() => setConfirm(false)}>{t('common.cancel')}</button>
              <button class="confirm__ok confirm__ok--reorg" onClick={() => { setConfirm(false); void game.reorganize() }}>{t('reorg.confirm.go', coins(claim))}</button>
            </div>
          </div>
        </div>
      )}
      <SectionHint section="reorg" />
    </div>
  )
}

/** Окно после реорганизации: сколько монет пришло и какой теперь множитель. */
export function ReorgReport() {
  const game = useGame()
  const report = game.reorgReport.value
  if (!report) return null
  const { content, state } = game.engine
  const close = () => (game.reorgReport.value = null)
  return (
    <div class="overlay" onClick={close}>
      <div class="rewind" onClick={(e) => e.stopPropagation()}>
        <Icon src={iconUrl('reorg')} class="rewind__img" />
        <div class="rewind__title">{t('reorg.done.title')}</div>
        <div class="rewind__earned">+{coins(report.coins)} TechCoin</div>
        <p class="rewind__note">{t('reorg.done.text', mult(coinProfitMultiplier(content, state)))}</p>
        <button class="rewind__ok rewind__ok--reorg" onClick={close}>{t('common.gotIt')}</button>
      </div>
    </div>
  )
}
