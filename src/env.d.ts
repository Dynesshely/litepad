/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: DefineComponent<Record<string, never>, Record<string, never>, any>
  export default component
}

interface Window {
  MonacoEnvironment?: {
    getWorker: (moduleId: string, label: string) => Worker
  }
}

/** 由 vite.config.ts 的 define 注入 */
declare const __APP_VERSION__: string
declare const __APP_BUILD__: string
/** origin 远端对应的网页地址（无远端时为空串，此时 UI 隐藏入口） */
declare const __APP_REPO__: string
