import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  // GitHub Pages: main → /help-desk-idle-web/, dev → /help-desk-idle-web/dev/ (BASE_PATH задаёт workflow).
  base: process.env.BASE_PATH ?? '/help-desk-idle-web/',
  plugins: [preact()],
  // Баланс, строки, иконки и шрифты читаются из iOS-части репо (на уровень выше web/).
  server: { fs: { allow: ['..'] } },
})
