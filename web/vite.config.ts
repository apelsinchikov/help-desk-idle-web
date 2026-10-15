import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  // GitHub Pages: https://apelsinchikov.github.io/help-desk-idle-web/
  base: '/help-desk-idle-web/',
  plugins: [preact()],
  // Баланс, строки, иконки и шрифты читаются из iOS-части репо (на уровень выше web/).
  server: { fs: { allow: ['..'] } },
})
