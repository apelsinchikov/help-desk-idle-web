// Edge Function: вход по Telegram Mini App initData → сессия Supabase для этого Telegram-аккаунта.
// Деплой: npx supabase functions deploy telegram-auth --project-ref <ref> --no-verify-jwt
// Секрет: TELEGRAM_BOT_TOKEN (Dashboard → Edge Functions → Secrets).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { verifyInitData } from './verify.ts'

const ALLOWED_ORIGINS = ['https://apelsinchikov.github.io', 'http://localhost:5173']

function cors(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

/** Ключи проекта: новый формат (JSON-словари) или legacy-строки. */
function key(kind: 'secret' | 'publishable'): string {
  const dict = Deno.env.get(kind === 'secret' ? 'SUPABASE_SECRET_KEYS' : 'SUPABASE_PUBLISHABLE_KEYS')
  if (dict) {
    try {
      const value = JSON.parse(dict).default
      if (value) return value
    } catch {
      // ниже — legacy
    }
  }
  return Deno.env.get(kind === 'secret' ? 'SUPABASE_SERVICE_ROLE_KEY' : 'SUPABASE_ANON_KEY') ?? ''
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get('origin')), 'Content-Type': 'application/json' }
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers })
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' })

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const url = Deno.env.get('SUPABASE_URL')
  if (!botToken || !url) return reply(500, { error: 'not_configured' })

  let initData = ''
  try {
    initData = String((await req.json())?.initData ?? '')
  } catch {
    return reply(400, { error: 'bad_request' })
  }
  const user = await verifyInitData(initData, botToken, Math.floor(Date.now() / 1000))
  if (!user) return reply(401, { error: 'bad_init_data' })

  const options = { auth: { persistSession: false, autoRefreshToken: false } }
  const admin = createClient(url, key('secret'), options)
  // Служебный адрес: писем на него не шлём, нужен только как стабильный идентификатор.
  const email = `tg${user.id}@telegram.local`

  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { telegram_id: user.id },
  })
  if (created.error && created.error.code !== 'email_exists') {
    return reply(500, { error: 'create_user_failed' })
  }

  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const tokenHash = link.data?.properties?.hashed_token
  if (link.error || !tokenHash) return reply(500, { error: 'generate_link_failed' })

  const client = createClient(url, key('publishable'), options)
  const verified = await client.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
  const session = verified.data?.session
  if (verified.error || !session) return reply(500, { error: 'verify_failed' })

  return reply(200, { access_token: session.access_token, refresh_token: session.refresh_token })
})
