// Деньги и длительности. Порт GameNumberFormatter.swift и GameDurationFormatter.swift.

export type AppLanguage = 'ru' | 'en'

const ruScale = ['млн', 'млрд', 'трлн', 'квдрлн', 'квнтлн']
const enScale = ['million', 'billion', 'trillion', 'quadrillion', 'quintillion']
const groupSeparator = (l: AppLanguage) => (l === 'ru' ? ' ' : ',')
const decimalSeparator = (l: AppLanguage) => (l === 'ru' ? ',' : '.')

/** «186 420», «1,24 млн», «3,72 трлн», дальше «1 aa», «1 ab»… */
export function formatMoney(value: number, language: AppLanguage): string {
  if (!Number.isFinite(value)) return '∞'
  const sign = value < 0 ? '-' : ''
  const v = Math.abs(value)

  if (v < 1_000_000) {
    if (v < 1_000 && Math.round(v) !== v) return sign + decimal(v, 2, language)
    return sign + grouped(Math.round(v), language)
  }

  let exponent = Math.floor(Math.log10(v) / 3) * 3
  let mantissa = v / Math.pow(10, exponent)
  let digits = mantissa < 10 ? 2 : mantissa < 100 ? 1 : 0
  // 999,95 млн → «1 млрд», а не «1000 млн»
  if (Math.round(mantissa * Math.pow(10, digits)) >= 1000 * Math.pow(10, digits)) {
    exponent += 3
    mantissa = v / Math.pow(10, exponent)
    digits = 2
  }
  return sign + decimal(mantissa, digits, language) + ' ' + scaleName(exponent, language)
}

function scaleName(exponent: number, language: AppLanguage): string {
  const index = (exponent - 6) / 3
  const names = language === 'ru' ? ruScale : enScale
  if (index < names.length) return names[index]
  const k = index - names.length
  const letters = 'abcdefghijklmnopqrstuvwxyz'
  return letters[Math.min(Math.floor(k / 26), 25)] + letters[k % 26]
}

/** Фиксированное число знаков, без хвостовых нулей. */
function decimal(v: number, digits: number, language: AppLanguage): string {
  let text = v.toFixed(digits)
  if (text.includes('.')) text = text.replace(/0+$/, '').replace(/\.$/, '')
  const [int, frac] = text.split('.')
  const integer = grouped(Number(int), language)
  return frac !== undefined ? integer + decimalSeparator(language) + frac : integer
}

function grouped(n: number, language: AppLanguage): string {
  const digits = String(Math.trunc(n))
  let out = ''
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += groupSeparator(language)
    out += digits[i]
  }
  return out
}

/** «11 мин 42 с», «1 ч 20 мин», «3 д 4 ч», «1,5 с». */
export function formatDuration(seconds: number, language: AppLanguage): string {
  const s = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const ru = language === 'ru'
  const [d, h, m, sec] = ru ? ['д', 'ч', 'мин', 'с'] : ['d', 'h', 'min', 's']
  const total = Math.trunc(s)

  if (total >= 86_400) {
    const days = Math.floor(total / 86_400)
    const hours = Math.floor((total % 86_400) / 3_600)
    return hours > 0 ? `${days} ${d} ${hours} ${h}` : `${days} ${d}`
  }
  if (total >= 3_600) {
    const hours = Math.floor(total / 3_600)
    const minutes = Math.floor((total % 3_600) / 60)
    return minutes > 0 ? `${hours} ${h} ${minutes} ${m}` : `${hours} ${h}`
  }
  if (total >= 60) return `${Math.floor(total / 60)} ${m} ${total % 60} ${sec}`
  let text = s.toFixed(1)
  if (text.endsWith('.0')) text = text.slice(0, -2)
  if (ru) text = text.replace('.', ',')
  return `${text} ${sec}`
}

/** Таймер работы: до минуты — всегда с одним знаком («0,0 с», «3,0 с»), чтобы цифры не прыгали. */
export function formatTimer(seconds: number, language: AppLanguage): string {
  const s = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  if (s >= 60) return formatDuration(s, language)
  const text = s.toFixed(1)
  return language === 'ru' ? `${text.replace('.', ',')} с` : `${text} s`
}
