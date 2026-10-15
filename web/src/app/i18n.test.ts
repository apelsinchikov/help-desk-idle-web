import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createI18n, detectLanguage, formatString, parseXcstrings } from './i18n.ts'

const xcstrings = JSON.parse(
  readFileSync(new URL('../../../HelpDeskIdle/HelpDeskIdle/Localization/Localizable.xcstrings', import.meta.url), 'utf8'),
)
const tables = parseXcstrings(xcstrings)

test('parses both languages from xcstrings', () => {
  assert.equal(tables.en['buy.button'], 'Buy ×%lld')
  assert.equal(tables.ru['job.ready'], 'Готово — собрать')
  assert.equal('%lld' in tables.en, false, 'ключи без локализаций пропускаются')
})

test('formats placeholders', () => {
  assert.equal(formatString('Buy ×%lld', [10]), 'Buy ×10')
  assert.equal(formatString('saved at %@', ['12:00']), 'saved at 12:00')
  assert.equal(formatString('%2$@ — %1$@', ['a', 'b']), 'b — a')
  assert.equal(formatString('Нужно: «%1$@» ур. %2$lld', ['X', 25]), 'Нужно: «X» ур. 25')
  assert.equal(formatString('%d and %d', [1, 2]), '1 and 2')
  assert.equal(formatString('100%%', []), '100%')
})

test('t follows current language and falls back', () => {
  let lang: 'ru' | 'en' = 'ru'
  const t = createI18n({ ru: { a: 'А' }, en: { a: 'A', b: 'B' } }, () => lang)
  assert.equal(t('a'), 'А')
  lang = 'en'
  assert.equal(t('a'), 'A')
  lang = 'ru'
  assert.equal(t('b'), 'B', 'нет перевода → другой язык')
  assert.equal(t('missing'), 'missing', 'нет нигде → ключ')
})

test('detects language', () => {
  assert.equal(detectLanguage('ru-RU'), 'ru')
  assert.equal(detectLanguage('ru'), 'ru')
  assert.equal(detectLanguage('en-US'), 'en')
  assert.equal(detectLanguage(undefined), 'en')
})
