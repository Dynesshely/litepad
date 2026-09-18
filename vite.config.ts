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
  let base = '/'
  return {
    name: 'litepad:favicon',
    configResolved(config) {
      root = config.root
      // base 已被 Vite 规范化（一定带尾斜杠），子路径部署时形如 /litepad/
      base = config.base
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        let url = (req.url || '').split('?')[0]
        // dev 也可能带 base（vite --base=/litepad/），先把前缀去掉再比对
        if (base !== '/' && url.startsWith(base)) url = '/' + url.slice(base.length)
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
    /**
     * index.html 里的 `/favicon.svg` 必须自己补 base。
     *
     * 这个文件是本插件在构建期 emit 出来的，不属于 Vite 眼中的 public 资源，
     * 因此 HTML 处理器不会给它加 base 前缀（同一份 HTML 里的 /favicon.ico、
     * /site.webmanifest 等来自 public/，会被正常改写）。
     * 子路径部署（GitHub Pages 的 /<repo>/）下不改写就会 404，所以由插件自己负责。
     */
    transformIndexHtml: {
      order: 'post',
      handler: (html) => html.replace(/(href|src)="\/favicon\.svg"/g, `$1="${base}favicon.svg"`),
    },
  }
}

/**
 * origin 远端地址 → 浏览器可打开的网址。
 * 支持 scp 形式（git@github.com:owner/repo.git）、ssh:// 与 http(s)；
 * 本地路径远端或没有 remote 时返回空串，UI 会据此隐藏入口。
 */
function normalizeRemoteUrl(url: string): string {
  const s = url.trim()
  if (!s) return ''
  const scp = /^(?:ssh:\/\/)?git@([^:/]+)[:/](.+?)(?:\.git)?$/.exec(s)
  if (scp) return `https://${scp[1]}/${scp[2]}`
  const clean = s.replace(/\.git$/, '')
  return /^https?:\/\//.test(clean) ? clean : ''
}

/**
 * 取 origin 的网页地址（拿不到则留空）。
 * 优先用 `APP_REPO_URL` 环境变量 —— 容器构建时没有 .git，只能靠构建参数传进来。
 */
function gitRemoteUrl(): string {
  const fromEnv = process.env.APP_REPO_URL?.trim()
  if (fromEnv) return normalizeRemoteUrl(fromEnv)
  try {
    return normalizeRemoteUrl(
      execFileSync('git', ['remote', 'get-url', 'origin'], {
        cwd: fileURLToPath(new URL('.', import.meta.url)),
        encoding: 'utf8',
      }),
    )
  } catch {
    return ''
  }
}

/**
 * 取构建号：优先 `APP_BUILD` 环境变量（容器构建用），否则取当前 git 短哈希，
 * 都拿不到时回退 `dev`（非 git 环境、未安装 git、或 .git 不在构建上下文里）。
 */
function buildId(): string {
  const fromEnv = process.env.APP_BUILD?.trim()
  if (fromEnv) return fromEnv
  try {
    return (
      execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
        cwd: fileURLToPath(new URL('.', import.meta.url)),
        encoding: 'utf8',
      }).trim() || 'dev'
    )
  } catch {
    return 'dev'
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
    __APP_BUILD__: JSON.stringify(buildId()),
    __APP_REPO__: JSON.stringify(gitRemoteUrl()),
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
