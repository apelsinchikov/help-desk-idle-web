import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bundledContent } from '../core/bundled.ts'
import { newGame } from '../core/state.ts'
import { createLocalSave } from './storage.ts'
import type { KeyValueStorage } from './storage.ts'

function memory(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

const game = (money: number) => {
  const s = newGame(bundledContent, 1000, 'ru', 1)
  s.money = money
  return s
}

test('save then load returns the same state', () => {
  const store = createLocalSave(memory())
  store.save(game(5))
  assert.deepEqual(store.load(), game(5))
})

test('second save keeps previous valid copy as backup', () => {
  const mem = memory()
  const store = createLocalSave(mem)
  store.save(game(1))
  store.save(game(2))
  assert.equal(JSON.parse(mem.map.get('hdi.save.prev')!).money, 1)
  assert.equal(store.load()!.money, 2)
})

test('broken current save falls back to backup', () => {
  const mem = memory()
  const store = createLocalSave(mem)
  store.save(game(1))
  store.save(game(2))
  mem.map.set('hdi.save', '{oops')
  assert.equal(store.load()!.money, 1)
})

test('broken current save does not overwrite good backup', () => {
  const mem = memory()
  const store = createLocalSave(mem)
  store.save(game(1))
  store.save(game(2))
  mem.map.set('hdi.save', '{oops')
  store.save(game(3))
  assert.equal(JSON.parse(mem.map.get('hdi.save.prev')!).money, 1)
})

test('both broken → null', () => {
  const mem = memory()
  mem.map.set('hdi.save', 'x')
  mem.map.set('hdi.save.prev', 'y')
  assert.equal(createLocalSave(mem).load(), null)
})

test('throwing storage never crashes the game', () => {
  const boom = () => { throw new Error('QuotaExceededError') }
  const store = createLocalSave({ getItem: boom, setItem: boom, removeItem: boom })
  assert.equal(store.load(), null)
  assert.doesNotThrow(() => store.save(game(1)))
})

test('missing global localStorage works as empty', () => {
  const store = createLocalSave()
  assert.equal(store.load(), null)
  assert.doesNotThrow(() => store.save(game(1)))
})

test('saves of different Telegram accounts are kept apart', () => {
  const mem = memory()
  const a = createLocalSave(mem, 'tg1')
  const b = createLocalSave(mem, 'tg2')
  a.save(game(111))
  assert.equal(b.load(), null)
  b.save(game(222))
  assert.equal(a.load()!.money, 111)
  assert.equal(b.load()!.money, 222)
})
