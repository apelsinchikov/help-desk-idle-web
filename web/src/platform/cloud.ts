// Облачный сейв в Supabase (таблица public.game_saves, одна строка на игрока). Только внутри Telegram:
// сессию выдаёт Edge Function telegram-auth по подписанной initData.
import { createClient } from '@supabase/supabase-js'
import type { RemoteSave } from '../app/cloudGate.ts'
import { decodeState, encodeState } from '../core/serialize.ts'
import type { GameState } from '../core/state.ts'

export type CloudSync = {
  download(): Promise<RemoteSave>
  upload(state: GameState): Promise<void>
}

type Tokens = { access_token: string; refresh_token: string }

export function createCloud(
  env: { url?: string; key?: string },
  telegram: { initData: string; userId?: number },
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
      const state = decodeState(data.payload)
      return state ? { kind: 'ok', state } : { kind: 'unreadable' }
    },

    async upload(state) {
      const id = await userId()
      const { error } = await supabase.from('game_saves').upsert({
        user_id: id,
        payload: JSON.parse(encodeState(state)),
        schema_version: state.schemaVersion,
        lifetime_earnings: state.lifetimeEarnings,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
    },
  }
}
