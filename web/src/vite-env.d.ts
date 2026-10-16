/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** 'dev' — тестовая сборка из ветки dev (без облака, свои сейвы, метка DEV). */
  readonly VITE_CHANNEL?: string
  /** ID блока AdsGram (формат Reward) для энергетиков. */
  readonly VITE_ADSGRAM_BLOCK_ID?: string
}
