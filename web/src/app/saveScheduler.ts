// Когда сохранять. Покупки — локально сразу; тики — локально раз в интервал;
// облако не чаще `cloudIntervalMs`; flush (уход в фон) — всё и сразу. Ошибки облака не мешают игре.

export type SaveScheduler = {
  changed(kind: 'purchase' | 'tick'): void
  flush(): Promise<void>
}

export function createSaveScheduler(o: {
  saveLocal(): void
  uploadCloud(): Promise<void>
  localIntervalMs: number
  cloudIntervalMs: number
  now: () => number
}): SaveScheduler {
  let lastLocal = o.now()
  let lastCloud = -Infinity

  const saveLocal = () => {
    lastLocal = o.now()
    o.saveLocal()
  }
  const upload = async () => {
    lastCloud = o.now()
    try {
      await o.uploadCloud()
    } catch {
      // статус «нет связи» выставляет сам uploadCloud; повторим при следующем сохранении
    }
  }

  return {
    changed(kind) {
      const now = o.now()
      if (kind === 'purchase' || now - lastLocal >= o.localIntervalMs) saveLocal()
      if (now - lastCloud >= o.cloudIntervalMs) void upload()
    },
    async flush() {
      saveLocal()
      await upload()
    },
  }
}
