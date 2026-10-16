// Реклама за награду (AdsGram, формат Reward): ролик на весь экран, досмотрел — награда, закрыл раньше — нет.
// Скрипт сети грузится только при первом показе. Без ID блока: в тестовой сборке — имитация ролика, иначе рекламы нет.

export type AdResult = 'done' | 'skipped' | 'unavailable'
export type Ads = { show(): Promise<AdResult> }

type ShowResult = { done?: boolean; error?: boolean; description?: string }
type AdController = { show(): Promise<ShowResult> }
type AdsgramGlobal = { init(o: { blockId: string; debug?: boolean }): AdController }

const SCRIPT = 'https://sad.adsgram.ai/js/sad.min.js'
const FAKE_AD_MS = 1500

function loadScript(): Promise<AdsgramGlobal> {
  const existing = (window as { Adsgram?: AdsgramGlobal }).Adsgram
  if (existing) return Promise.resolve(existing)
  return new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = SCRIPT
    el.async = true
    el.onload = () => {
      const g = (window as { Adsgram?: AdsgramGlobal }).Adsgram
      if (g) resolve(g)
      else reject(new Error('adsgram_missing'))
    }
    el.onerror = () => reject(new Error('adsgram_load_failed'))
    document.head.appendChild(el)
  })
}

export function createAds(o: { blockId?: string; devBuild: boolean }): Ads | null {
  if (!o.blockId) {
    if (!o.devBuild) return null
    return { show: () => new Promise((r) => setTimeout(() => r('done'), FAKE_AD_MS)) }
  }
  let controller: Promise<AdController> | null = null
  return {
    async show() {
      try {
        controller ??= loadScript().then((g) => g.init({ blockId: o.blockId!, debug: o.devBuild }))
        const result = await (await controller).show()
        return result.done ? 'done' : 'skipped'
      } catch (e) {
        const r = e as ShowResult
        // закрыл ролик раньше — это не ошибка сети
        if (r && r.done === false && !r.error) return 'skipped'
        controller = null
        return 'unavailable'
      }
    },
  }
}
