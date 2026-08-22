import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base: './' — 어떤 정적 호스팅 경로(GitHub Pages 하위 경로 포함)에서도 동작
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: false,
  },
})
