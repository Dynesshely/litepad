import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string
}

/** 取当前 git 短哈希作为构建号（非 git 环境或未安装 git 时留空） */
function gitShortSha(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: fileURLToPath(new URL('.', import.meta.url)),
      encoding: 'utf8',
    }).trim()
  } catch {
    return ''
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(gitShortSha()),
  },
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
