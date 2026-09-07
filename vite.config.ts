import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4096, // monaco 体积较大，放宽提示
  },
  server: {
    host: '0.0.0.0',
    port: 18080, // 固定五位数端口，dev 与 preview 统一（同一时刻只跑一个）
  },
  preview: {
    host: '0.0.0.0',
    port: 18080,
  },
})
