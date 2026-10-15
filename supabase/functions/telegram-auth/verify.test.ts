import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { verifyInitData } from './verify.ts'

const BOT = '123456:TEST-token'
const NOW = 1_800_000_000

/** initData так, как её подписывает Telegram. */
function sign(fields: Record<string, string>, token = BOT): string {
  const check = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  const hash = createHmac('sha256', secret).update(check).digest('hex')
  return new URLSearchParams({ ...fields, hash }).toString()
}

const fields = {
  auth_date: String(NOW - 60),
  query_id: 'AAE',
  user: JSON.stringify({ id: 42, first_name: 'Evgeniy', language_code: 'ru' }),
}

test('valid initData returns the Telegram user', async () => {
  assert.deepEqual(await verifyInitData(sign(fields), BOT, NOW), { id: 42, languageCode: 'ru' })
})

test('tampered field is rejected', async () => {
  const forged = sign(fields).replace('%22id%22%3A42', '%22id%22%3A43')
  assert.equal(await verifyInitData(forged, BOT, NOW), null)
})

test('wrong bot token is rejected', async () => {
  assert.equal(await verifyInitData(sign(fields, '999:OTHER'), BOT, NOW), null)
})

test('initData older than 24 hours is rejected', async () => {
  const old = sign({ ...fields, auth_date: String(NOW - 86_401) })
  assert.equal(await verifyInitData(old, BOT, NOW), null)
})

test('missing hash or user is rejected', async () => {
  assert.equal(await verifyInitData(new URLSearchParams(fields).toString(), BOT, NOW), null)
  const { user: _user, ...noUser } = fields
  assert.equal(await verifyInitData(sign(noUser), BOT, NOW), null)
  assert.equal(await verifyInitData('', BOT, NOW), null)
})
