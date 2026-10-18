// Обёртка над Telegram Mini Apps SDK (telegram-web-app.js). Вне Telegram всё — no-op.
import { displayName } from '../app/leaderboard.ts'
type Inset = { top: number; bottom: number; left: number; right: number }
type WebApp = {
  initData: string
  initDataUnsafe: { user?: { id: number; language_code?: string; first_name?: string; last_name?: string } }
  version: string
  platform: string
  isVersionAtLeast(v: string): boolean
  ready(): void
  expand(): void
  disableVerticalSwipes?(): void
  requestFullscreen?(): void
  lockOrientation?(): void
  setHeaderColor?(color: string): void
  setBackgroundColor?(color: string): void
  setBottomBarColor?(color: string): void
  safeAreaInset?: Inset
  contentSafeAreaInset?: Inset
  onEvent(event: string, cb: () => void): void
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void }
  HapticFeedback: { impactOccurred(style: 'light'): void; notificationOccurred(type: 'success'): void }
}

const webApp: WebApp | undefined = (globalThis as { Telegram?: { WebApp?: WebApp } }).Telegram?.WebApp
const inside = !!webApp && webApp.initData.length > 0
let backHandler: (() => void) | null = null
/** Полный экран — только на телефонах: на десктопе он разворачивает окно Telegram целиком. */
const MOBILE = new Set(['ios', 'android', 'android_x'])

export const telegram = {
  isTelegram: inside,
  initData: inside ? webApp!.initData : '',
  languageCode: inside ? webApp!.initDataUnsafe.user?.language_code : undefined,
  /** Telegram ID игрока (не проверен — для разделения локальных сейвов; проверяет сервер). */
  userId: inside ? webApp!.initDataUnsafe.user?.id : undefined,
  /** Имя для рейтинга («Евгений А.»). */
  displayName: inside ? displayName(webApp!.initDataUnsafe.user) : '',

  /**
   * Готовность, весь экран, свайп вниз не закрывает игру, цвета шапки под тему A.
   * На телефоне (Bot API 8.0+) — полноэкранный режим без шапки Telegram и с портретной ориентацией;
   * отступы под «чёлку» и кнопки Telegram приходят через safeAreaInset / contentSafeAreaInset.
   */
  init(background: string): void {
    if (!inside) return
    const app = webApp!
    app.ready()
    app.expand()
    if (app.isVersionAtLeast('7.7')) app.disableVerticalSwipes?.()
    if (app.isVersionAtLeast('6.1')) {
      app.setHeaderColor?.(background)
      app.setBackgroundColor?.(background)
    }
    if (app.isVersionAtLeast('7.10')) app.setBottomBarColor?.(background)
    if (app.isVersionAtLeast('8.0') && MOBILE.has(app.platform)) {
      app.requestFullscreen?.()
      if (window.innerHeight > window.innerWidth) app.lockOrientation?.()
    }
    applySafeArea()
    app.onEvent('safeAreaChanged', applySafeArea)
    app.onEvent('contentSafeAreaChanged', applySafeArea)
    app.onEvent('fullscreenChanged', applySafeArea)
  },

  /** Системная кнопка «Назад» Telegram: показать с обработчиком или спрятать (null). */
  onBack(cb: (() => void) | null): void {
    if (!inside || !webApp!.isVersionAtLeast('6.1')) return
    const back = webApp!.BackButton
    if (backHandler) back.offClick(backHandler)
    backHandler = cb
    if (cb) {
      back.onClick(cb)
      back.show()
    } else {
      back.hide()
    }
  },

  /** Свернули / развернули Mini App (Bot API 8.0+). */
  onLifecycle(hidden: () => void, visible: () => void): void {
    if (!inside || !webApp!.isVersionAtLeast('8.0')) return
    webApp!.onEvent('deactivated', hidden)
    webApp!.onEvent('activated', visible)
  },

  haptic(kind: 'light' | 'success'): void {
    if (!inside || !webApp!.isVersionAtLeast('6.1')) return
    if (kind === 'light') webApp!.HapticFeedback.impactOccurred('light')
    else webApp!.HapticFeedback.notificationOccurred('success')
  },
}

/** Отступы Telegram (полноэкранный режим, «чёлка», шапка клиента) → CSS-переменные. */
function applySafeArea(): void {
  const app = webApp!
  const top = (app.safeAreaInset?.top ?? 0) + (app.contentSafeAreaInset?.top ?? 0)
  const bottom = (app.safeAreaInset?.bottom ?? 0) + (app.contentSafeAreaInset?.bottom ?? 0)
  const root = document.documentElement.style
  // 0 — вернуть системный env(): после выхода из полного экрана отступы Telegram обнуляются
  if (top > 0) root.setProperty('--safe-top', `${top}px`)
  else root.removeProperty('--safe-top')
  if (bottom > 0) root.setProperty('--safe-bottom', `${bottom}px`)
  else root.removeProperty('--safe-bottom')
}
