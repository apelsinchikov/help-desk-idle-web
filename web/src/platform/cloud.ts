// Облачный сейв в Supabase (таблица public.game_saves, одна строка на игрока). Только внутри Telegram:
// сессию выдаёт Edge Function telegram-auth по подписанной initData.
import { createClient } from '@supabase/supabase-js'
import type { RemoteSave } from '../app/cloudGate.ts'
import type { Leaderboard, LeaderRow } from '../app/leaderboard.ts'
import { bundledContent } from '../core/bundled.ts'
import { decodeState, encodeState } from '../core/serialize.ts'
import type { GameState } from '../core/state.ts'

export type CloudSync = {
  download(): Promise<RemoteSave>
  upload(state: GameState): Promise<void>
  /** Время сервера (мс) и когда (по часам устройства) ушёл запрос и пришёл ответ. */
  serverTime(): Promise<{ server: number; sentAt: number; receivedAt: number }>
  /** Топ-50 рейтинга и своя строка (её может не быть: ещё не выгрузились или пересчёт не прошёл). */
  leaderboard(): Promise<Leaderboard>
}

type BoardRow = { place: number; user_id: string; display_name: string; lifetime_earnings: number; refreshed_at: string }

type Tokens = { access_token: string; refresh_token: string }

export function createCloud(
  env: { url?: string; key?: string },
  telegram: { initData: string; userId?: number; displayName?: string },
): CloudSync | null {
  if (!env.url || !env.key || !telegram.initData || telegram.userId === undefined) return null
  const supabase = createClient(env.url, env.key)
  let signingIn: Promise<string> | null = null

  const signIn = async (): Promise<string> => {
    const { data } = await supabase.auth.getSession()
    const session = data.session
    // Сессия другого Telegram-аккаунта (несколько аккаунтов в одном клиенте) — выходим и входим заново.
    if (session && session.user.app_metadata?.telegram_id === telegram.userId) return session.user.id
    if (session) await supabase.auth.signOut({ scope: 'local' })
    const res = await supabase.functions.invoke<Tokens>('telegram-auth', { body: { initData: telegram.initData } })
    if (res.error || !res.data) throw res.error ?? new Error('telegram-auth failed')
    const set = await supabase.auth.setSession(res.data)
    if (set.error || !set.data.session) throw set.error ?? new Error('setSession failed')
    return set.data.session.user.id
  }

  /** Один вход на все параллельные запросы (загрузка при старте и первая выгрузка). */
  const userId = (): Promise<string> => {
    signingIn ??= signIn().finally(() => { signingIn = null })
    return signingIn
  }

  return {
    async download() {
      const id = await userId()
      const { data, error } = await supabase.from('game_saves').select('payload').eq('user_id', id).maybeSingle()
      if (error) throw error
      if (!data) return { kind: 'none' }
      const state = decodeState(data.payload, bundledContent)
      return state ? { kind: 'ok', state } : { kind: 'unreadable' }
    },

    async serverTime() {
      await userId()
      const sentAt = Date.now()
      const { data, error } = await supabase.rpc('server_now')
      const receivedAt = Date.now()
      if (error) throw error
      return { server: Date.parse(String(data)), sentAt, receivedAt }
    },

    async leaderboard() {
      const id = await userId()
      const columns = 'place, user_id, display_name, lifetime_earnings, refreshed_at'
      const [top, mine] = await Promise.all([
        supabase.from('leaderboard').select(columns).order('place').limit(50),
        supabase.from('leaderboard').select(columns).eq('user_id', id).maybeSingle(),
      ])
      if (top.error) throw top.error
      if (mine.error) throw mine.error
      const row = (r: BoardRow): LeaderRow => ({ place: r.place, name: r.display_name, earned: r.lifetime_earnings, me: r.user_id === id })
      const rows = (top.data ?? []) as BoardRow[]
      const me = mine.data ? row(mine.data as BoardRow) : null
      const refreshed = rows[0]?.refreshed_at ?? (mine.data as BoardRow | null)?.refreshed_at
      return { top: rows.map(row), me, refreshedAt: refreshed ? Date.parse(refreshed) : Date.now() }
    },

    async upload(state) {
      const id = await userId()
      const { error } = await supabase.from('game_saves').upsert({
        user_id: id,
        payload: JSON.parse(encodeState(state)),
        schema_version: state.schemaVersion,
        lifetime_earnings: state.lifetimeEarnings,
        display_name: telegram.displayName ?? '',
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
    },
  }
}
