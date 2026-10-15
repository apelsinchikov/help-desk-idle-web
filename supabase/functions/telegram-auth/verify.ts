// Проверка подписи Telegram Mini App initData (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
// Только WebCrypto — работает и в Deno (Edge Function), и в Node (тесты).

export type TelegramUser = { id: number; languageCode?: string }

const encoder = new TextEncoder()

async function hmac(key: BufferSource, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data))
}

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

/** Сравнение без раннего выхода, чтобы время не подсказывало подпись. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifyInitData(
  initData: string,
  botToken: string,
  nowSec: number,
  maxAgeSec = 86_400,
): Promise<TelegramUser | null> {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')

  const check = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const secret = await hmac(encoder.encode('WebAppData'), botToken)
  const expected = toHex(await hmac(secret, check))
  if (!safeEqual(expected, hash.toLowerCase())) return null

  const authDate = Number(params.get('auth_date'))
  if (!Number.isFinite(authDate) || nowSec - authDate > maxAgeSec) return null

  try {
    const user = JSON.parse(params.get('user') ?? '')
    if (typeof user?.id !== 'number') return null
    return user.language_code ? { id: user.id, languageCode: user.language_code } : { id: user.id }
  } catch {
    return null
  }
}
