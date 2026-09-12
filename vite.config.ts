import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string
}

/** 站点图标的单一来源（src 内，供 ?raw 内联与产物输出共用一份文件） */
const FAVICON_REL = 'src/assets/favicon.svg'

/**
 * 站点图标插件：
 *  - dev：把 src/assets/favicon.svg 作为 /favicon.svg 提供（publicDir 里不再放副本）；
 *  - build：把同一份文件输出到产物根目录，供 index.html / site.webmanifest 引用。
 * 这样「浏览器标签页图标」与「页内 LOGO 的 ?raw 内联」共用同一份源码，
 * 同时避免 Vite 对 “从 public 目录 import” 的告警。
 */
function faviconPlugin(): Plugin {
  let root = process.cwd()
  return {
    name: 'litepad:favicon',
    configResolved(config) {
      root = config.root
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0]
        if (url !== '/favicon.svg') {
          next()
          return
        }
        try {
          const svg = readFileSync(resolve(server.config.root, FAVICON_REL))
          res.setHeader('Content-Type', 'image/svg+xml')
          res.setHeader('Cache-Control', 'no-cache')
          res.end(svg)
        } catch (err) {
          server.config.logger.error(`[favicon] 读取 ${FAVICON_REL} 失败: ${String(err)}`)
          next()
        }
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'favicon.svg',
        source: readFileSync(resolve(root, FAVICON_REL), 'utf8'),
      })
    },
  }
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

/**
 * 反代/自定义域名白名单：Vite 会对 Host 头做校验，未列入的主机会返回 403。
 * 需要新增域名时加到这里（以 "." 开头表示同时允许其子域）。
 */
const ALLOWED_HOSTS = ['litepad.dev-u26-001.services.local']

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss(), faviconPlugin()],
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
    allowedHosts: ALLOWED_HOSTS,
    watch: {
      // 不要把「构建产物」和「本地 dev server 的日志/PID」当成源码变更：
      // 否则写日志 / 跑 build 会反复触发热重载甚至服务重启，打断正在进行的请求与测试。
      ignored: ['**/dist/**', '**/.dev-server.log', '**/.dev-server.pid'],
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 18080,
    allowedHosts: ALLOWED_HOSTS,
  },
})
