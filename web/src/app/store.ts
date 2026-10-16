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
import { grantPerk } from '../core/perks.ts'
import { nextItem } from '../core/items.ts'
import { completeQuests, fillQuests, rerollQuest } from '../core/quests.ts'
import { claimTrack } from '../core/track.ts'
import type { Reward } from '../core/track.ts'
import type { Slot } from '../core/content.ts'
import type { SaveScheduler } from './saveScheduler.ts'

export type CloudStatus =
  | { kind: 'disabled' }
  | { kind: 'syncing' }
  | { kind: 'synced'; at: number }
  | { kind: 'offline' }

export type Route = 'jobs' | 'menu' | 'managers' | 'settings' | 'upgrades' | 'achievements' | 'backpack' | 'wardrobe' | 'shop' | 'quests'

const TICK_MS = 100

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
}) {
  const now = o.now ?? Date.now
  const { engine, scheduler } = o
  /** Растёт после любого изменения состояния: компоненты читают его, затем данные из engine. */
  const version = signal(0)
  const buyMode = signal<BuyMode>('one')
  const offlineReport = signal<OfflineReport | null>(null)
  const route = signal<Route>('jobs')
  const language = o.language
  language.value = engine.state.settings.language
  /** Очередь сообщений внизу экрана (тосты и заявки); UI показывает первое и снимает dismissMessage(). */
  const messages = signal<Message[]>([])
  /** Когда закрыли последнее сообщение: следующая заявка — не раньше чем через ticketEverySeconds. */
  let lastShownAt = now()
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
    route,
    language,
    cloudStatus: o.cloudStatus,
    messages,
    devBuild: o.devBuild ?? false,

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

    /** Включить перк из рюкзака; перемотка — тост с заработанным. */
    activatePerk(perkId: string): void {
      const perk = engine.content.perk(perkId)
      if (!perk) return
      const before = engine.state.money
      game.act('purchase', () => { if (engine.activatePerk(perkId)) game.haptic('success') })
      if (perk.kind === 'rewind') game.pushToast({ key: 'toast.rewind', args: [perk.minutes, { money: engine.state.money - before }] })
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

    /** Вещь просмотрена в шкафу — метка «новое» и точка на «Меню» гаснут. */
    markSeen(itemId: string): void {
      if (engine.state.items.seen.includes(itemId)) return
      game.act('purchase', () => engine.state.items.seen.push(itemId))
    },

    buyUpgrade(upgradeId: string): void {
      game.act('purchase', () => { if (engine.buyUpgrade(upgradeId)) game.haptic('success') })
    },

    dismissMessage(): void {
      messages.value = messages.value.slice(1)
      lastShownAt = now()
    },

    /** Тик: пора — добавить заявку в техподдержку. */
    checkTicket(): void {
      const cfg = engine.content.config.messages
      const due = ticketDue({
        now: now(),
        lastShownAt,
        everySeconds: cfg.ticketEverySeconds,
        queueEmpty: messages.value.length === 0,
        onJobs: route.value === 'jobs',
        tutorialDone: engine.state.ui.tutorialDone,
      })
      if (due) messages.value = [{ kind: 'ticket', index: nextTicket(engine.state, cfg.tickets) }]
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
      game.act('purchase', () => engine.reset(Date.now()))
      await scheduler.flush()
    },

    startTicking(): void {
      if (timer !== null) return
      timer = setInterval(() => {
        // resume, а не advance: большой разрыв между тиками (замороженный WebView, перевод часов)
        // проходит через оффлайн-лимит и показывает «С возвращением».
        const report = engine.resume(Date.now())
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
      engine.advance(Date.now())
      await scheduler.flush()
    },

    /** Вернулись: оффлайн-доход и «С возвращением». */
    onVisible(): void {
      if (timer !== null) return
      const report = engine.resume(Date.now())
      if (report) offlineReport.value = report
      bump()
      game.startTicking()
    },
  }
  return game
}

export type Game = ReturnType<typeof createGame>
