// Облачный сейв в Supabase (таблица public.game_saves, одна строка на игрока). Только внутри Telegram:
// сессию выдаёт Edge Function telegram-auth по подписанной initData.
import { createClient } from '@supabase/supabase-js'
import { decodeState, encodeState } from '../core/serialize.ts'
import type { GameState } from '../core/state.ts'

export type CloudSync = {
  signIn(): Promise<void>
  download(): Promise<GameState | null>
  upload(state: GameState): Promise<void>
}

type Tokens = { access_token: string; refresh_token: string }

export function createCloud(env: { url?: string; key?: string }, initData: string): CloudSync | null {
  if (!env.url || !env.key || !initData) return null
  const supabase = createClient(env.url, env.key)

  const userId = async (): Promise<string> => {
    const { data } = await supabase.auth.getSession()
    if (data.session) return data.session.user.id
    const res = await supabase.functions.invoke<Tokens>('telegram-auth', { body: { initData } })
    if (res.error || !res.data) throw res.error ?? new Error('telegram-auth failed')
    const set = await supabase.auth.setSession(res.data)
    if (set.error || !set.data.session) throw set.error ?? new Error('setSession failed')
    return set.data.session.user.id
  }

  return {
    async signIn() {
      await userId()
    },

    async download() {
      const id = await userId()
      const { data, error } = await supabase.from('game_saves').select('payload').eq('user_id', id).maybeSingle()
      if (error) throw error
      return data ? decodeState(data.payload) : null
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
