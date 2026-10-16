// Связывает движок с UI (signals), тиком и сохранением. Аналог AppModel.swift без облака и навигации iOS.
import { signal } from '@preact/signals'
import type { Signal } from '@preact/signals'
import type { GameEngine } from '../core/engine.ts'
import type { AppLanguage } from '../core/format.ts'
import type { BuyMode, OfflineReport } from '../core/state.ts'
import { achievementText } from '../core/achievements.ts'
import type { AchievementText } from '../core/achievements.ts'
import { nextTicket, ticketDue } from '../core/messages.ts'
import type { Message } from '../core/messages.ts'
import type { Milestone } from '../core/content.ts'
import { refreshSections, tutorialAck, tutorialAdvance } from '../core/progress.ts'
import { grantPerk, markBackpackSeen } from '../core/perks.ts'
import { markItemsSeen, nextItem } from '../core/items.ts'
import { completeQuests, fillQuests, rerollQuest } from '../core/quests.ts'
import { claimTrack } from '../core/track.ts'
import type { Reward } from '../core/track.ts'
import type { Slot } from '../core/content.ts'
import type { SaveScheduler } from './saveScheduler.ts'
import type { LeaderboardCache } from './leaderboard.ts'
import type { Ads } from '../platform/ads.ts'
import { energyCans } from '../core/energy.ts'

export type CloudStatus =
  | { kind: 'disabled' }
  | { kind: 'syncing' }
  | { kind: 'synced'; at: number }
  | { kind: 'offline' }

export type Route = 'jobs' | 'menu' | 'managers' | 'settings' | 'upgrades' | 'achievements' | 'backpack' | 'wardrobe' | 'shop' | 'quests' | 'leaderboard'

const TICK_MS = 100
/** Шуток про «хватит пить энергетики» в строках: energy.joke.1…N. */
export const ENERGY_JOKES = 8

export function createGame(o: {
  engine: GameEngine
  scheduler: SaveScheduler
  cloudStatus: Signal<CloudStatus>
  /** Общий сигнал языка интерфейса (strings.ts). */
  language: Signal<AppLanguage>
  /** Вибро платформы (Telegram); вызывается, только если включено в настройках. */
  haptic?: (kind: 'light' | 'success') => void
  /** Часы (тесты подменяют). */
  now?: () => number
  /** Тестовая сборка (/dev/): в настройках есть выдача перков и вещей. */
  devBuild?: boolean
  /** Рейтинг (только с облаком). */
  leaderboard?: LeaderboardCache | null
  /** Реклама за награду (энергетики); null — рекламы нет. */
  ads?: Ads | null
}) {
  const now = o.now ?? Date.now
  const { engine, scheduler } = o
  /** Растёт после любого изменения состояния: компоненты читают его, затем данные из engine. */
  const version = signal(0)
  const buyMode = signal<BuyMode>('one')
  const offlineReport = signal<OfflineReport | null>(null)
  /** Все банки полные — номер шутки для облачка у кнопки (UI сам прячет через пару секунд). */
  const energyJoke = signal<number | null>(null)
  /** Идёт показ рекламы — кнопка ждёт. */
  const adBusy = signal(false)
  /** Итог перемотки для окна «Время перемотано». */
  const rewindReport = signal<{ minutes: number; earned: number } | null>(null)
  const route = signal<Route>('jobs')
  const language = o.language
  language.value = engine.state.settings.language
  /** Очередь сообщений внизу экрана (тосты и заявки); UI показывает первое и снимает dismissMessage(). */
  const messages = signal<Message[]>([])
  /** Когда показали прошлую заявку: следующая — через ticketEverySeconds, как только место свободно. */
  let lastTicketAt = now()
  let timer: ReturnType<typeof setInterval> | null = null

  /** Тост о награде трека. */
  const rewardToast = (r: Reward): AchievementText => {
    if (r.kind === 'item') return { key: 'toast.item', args: [`item.${r.itemId}.name`] }
    const perk = engine.content.perk(r.perkId)!
    return perk.kind === 'rewind'
      ? { key: 'toast.perk.rewind', args: [perk.minutes] }
      : { key: `toast.perk.${perk.kind}`, args: [Math.round(perk.value * 100), perk.minutes] }
  }

  /** Задания: выдать, засчитать, наградить звёздами и треком. Звезда — сохранение сразу. */
  const questsTick = () => {
    const at = now()
    fillQuests(engine, at)
    const gained = completeQuests(engine, at)
    if (gained === 0) return
    game.pushToast({ key: 'toast.star', args: [engine.state.stars] })
    for (const r of claimTrack(engine)) game.pushToast(rewardToast(r))
    game.haptic('success')
    scheduler.changed('purchase')
  }

  /** После любого изменения: задания, разделы меню, шаги обучения, перерисовка. */
  const bump = () => {
    questsTick()
    refreshSections(engine)
    tutorialAdvance(engine, route.value, buyMode.value)
    version.value++
  }

  const game = {
    engine,
    version,
    buyMode,
    offlineReport,
    rewindReport,
    energyJoke,
    adBusy,
    route,
    language,
    cloudStatus: o.cloudStatus,
    messages,
    /** Часы игры (с поправкой по серверу). */
    now,
    devBuild: o.devBuild ?? false,
    leaderboard: o.leaderboard ?? null,

    /** Действие игрока: покупки сохраняются сразу, тапы — по интервалу автосейва. */
    act(kind: 'purchase' | 'tap', fn: () => void): void {
      fn()
      bump()
      scheduler.changed(kind === 'purchase' ? 'purchase' : 'tick')
    },

    /** Повышение на пороге: тост с наградой, сохранение сразу. */
    promote(jobId: string): void {
      const gained: Milestone[] = []
      game.act('purchase', () => { gained.push(...(engine.promote(jobId) ?? [])) })
      if (gained.length === 0) return
      game.haptic('success')
      const index = engine.content.jobs.findIndex((j) => j.id === jobId)
      for (const m of gained) game.pushToast(achievementText(m, m.jobId === null ? -1 : index))
    },

    /** Тост встаёт в очередь раньше заявок. */
    pushToast(text: AchievementText): void {
      const queue = messages.value
      const firstTicket = queue.findIndex((m, i) => i > 0 && m.kind === 'ticket')
      const toast: Message = { kind: 'toast', text }
      messages.value = firstTicket < 0 ? [...queue, toast] : [...queue.slice(0, firstTicket), toast, ...queue.slice(firstTicket)]
    },

    /** Включить перк из рюкзака; перемотка — окно с заработанным. Повторный тап по кончившемуся перку ничего не делает. */
    activatePerk(perkId: string): void {
      const perk = engine.content.perk(perkId)
      if (!perk) return
      const before = engine.state.money
      let ok = false
      game.act('purchase', () => { ok = engine.activatePerk(perkId) })
      if (!ok) return
      game.haptic('success')
      if (perk.kind === 'rewind') rewindReport.value = { minutes: perk.minutes, earned: engine.state.money - before }
    },

    /** Только /dev/: по перку каждого типа (и следующая вещь — когда появится гардероб). */
    devGrant(): void {
      if (!game.devBuild) return
      game.act('purchase', () => {
        for (const id of ['speed_100_5', 'salary_10_5', 'level_15_5', 'rewind_10']) grantPerk(engine.state, id)
        const item = nextItem(engine.content, engine.state)
        if (item) engine.grantItem(item.id)
      })
    },

    /** Заменить задание (бесплатно раз в 4 ч). */
    rerollQuest(questId: number): void {
      game.act('purchase', () => rerollQuest(engine, questId, now()))
    },

    equip(itemId: string): void {
      game.act('purchase', () => { if (engine.equip(itemId)) game.haptic('light') })
    },

    unequip(slot: Slot): void {
      game.act('purchase', () => engine.unequip(slot))
    },

    /** Игрок увидел вещи (вкладка «Вещи» рюкзака или гардероб) — метки «новое» и точка на «Меню» гаснут. */
    markItemsSeen(): void {
      game.act('purchase', () => markItemsSeen(engine.state))
    },

    /** Игрок открыл рюкзак: новые перки и вещи просмотрены. */
    markBackpackSeen(): void {
      game.act('purchase', () => markBackpackSeen(engine.state))
    },

    buyUpgrade(upgradeId: string): void {
      game.act('purchase', () => { if (engine.buyUpgrade(upgradeId)) game.haptic('success') })
    },

    dismissMessage(): void {
      messages.value = messages.value.slice(1)
    },

    /** Тик: пора — добавить заявку в техподдержку. */
    checkTicket(): void {
      const cfg = engine.content.config.messages
      const due = ticketDue({
        now: now(),
        lastShownAt: lastTicketAt,
        everySeconds: cfg.ticketEverySeconds,
        queueEmpty: messages.value.length === 0,
        onJobs: route.value === 'jobs',
        tutorialDone: engine.state.ui.tutorialDone,
      })
      if (!due) return
      messages.value = [{ kind: 'ticket', index: nextTicket(engine.state, cfg.tickets) }]
      lastTicketAt = now()
    },

    /** «Ускорить»: банки полные — шутка; иначе реклама, досмотрел — +5 минут ускорения. */
    async watchAd(): Promise<void> {
      if (adBusy.value) return
      if (!energyCans(engine.content, engine.state, now()).canDrink) {
        energyJoke.value = Math.floor(Math.random() * ENERGY_JOKES) + 1
        return
      }
      if (!o.ads) {
        game.pushToast({ key: 'energy.noAds', args: [] })
        return
      }
      adBusy.value = true
      try {
        const result = await o.ads.show()
        if (result === 'done') game.act('purchase', () => { if (engine.drinkEnergy()) game.haptic('success') })
        else if (result === 'unavailable') game.pushToast({ key: 'energy.unavailable', args: [] })
      } finally {
        adBusy.value = false
      }
    },

    /** Окно вайпа прочитано. */
    ackWipe(): void {
      game.act('purchase', () => { engine.state.ui.wiped = false })
    },

    ackTutorial(): void {
      game.act('purchase', () => tutorialAck(engine, route.value, buyMode.value))
    },

    markHintSeen(section: string): void {
      if (engine.state.ui.hintsSeen.includes(section)) return
      game.act('purchase', () => engine.state.ui.hintsSeen.push(section))
    },

    /** Смена экрана тоже двигает обучение (шаги «Нажми Меню» → «Менеджеры»). */
    navigate(next: Route): void {
      route.value = next
      bump()
    },

    haptic(kind: 'light' | 'success'): void {
      if (engine.state.settings.haptics) o.haptic?.(kind)
    },

    setLanguage(next: AppLanguage): void {
      game.act('purchase', () => engine.updateSettings({ language: next }))
      language.value = next
    },

    /** «Начать заново»: локально и в облако сразу, иначе облачный сейв вернул бы старый прогресс. */
    async reset(): Promise<void> {
      game.act('purchase', () => engine.reset(now()))
      await scheduler.flush()
    },

    startTicking(): void {
      if (timer !== null) return
      timer = setInterval(() => {
        // resume, а не advance: большой разрыв между тиками (замороженный WebView, перевод часов)
        // проходит через оффлайн-лимит и показывает «С возвращением».
        const report = engine.resume(now())
        if (report) offlineReport.value = report
        bump()
        game.checkTicket()
        scheduler.changed('tick')
      }, TICK_MS)
    },

    stopTicking(): void {
      if (timer !== null) clearInterval(timer)
      timer = null
    },

    /** Mini App свернули или закрывают: догнать время и сохранить всё. */
    async onHidden(): Promise<void> {
      game.stopTicking()
      engine.advance(now())
      await scheduler.flush()
    },

    /** Вернулись: оффлайн-доход и «С возвращением». */
    onVisible(): void {
      if (timer !== null) return
      const report = engine.resume(now())
      if (report) offlineReport.value = report
      bump()
      game.startTicking()
    },
  }
  return game
}

export type Game = ReturnType<typeof createGame>
