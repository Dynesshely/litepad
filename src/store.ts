/**
 * 全局状态与核心逻辑（无外部依赖的单例 store，供组件以 reactive 方式订阅）。
 * 职责：文档模型、自动保存（防抖 + 关页 flush + 双键轮换 + 历史快照）、
 *       配额降级、导入导出、主题、抽屉/弹层开关。
 */
import { computed, reactive } from 'vue'
import {
  detectStore,
  isStoreOk,
  INDEX_KEY,
  UI_KEY,
  HINT_KEY,
  docKey,
  bakKey,
  histKey,
  rawGet,
  rawSet,
  rawDel,
} from './lib/storage'
import { fmtFull, fmtRel, fmtStamp, timeHM, titleOf, safeName } from './lib/format'
import { downloadBlob, downloadText } from './lib/download'

export interface DocMeta {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}
export interface Snap {
  t: number
  c: string
}
export interface Banner {
  msg: string
  kind: 'info' | 'warn' | 'error'
  sticky: boolean
  /** 关闭时需要落一个「不再提示」标记的横幅（如 file:// 提示） */
  ackKey?: string
}

const SAVE_DEBOUNCE = 400 // 停止输入后多久落盘
const SNAP_INTERVAL = 20000 // 两次快照最小间隔
const SNAP_MAX = 40 // 每篇最多快照数
const SNAP_MAX_CHARS = 600000 // 每篇快照合计字符上限

/* ---------------- 编辑器桥接（由 MonacoEditor.vue 注册） ---------------- */
export interface EditorSink {
  getText(): string
  setText(text: string): void
}
let sink: EditorSink | null = null
let suppressEvents = false

export function bindEditorSink(s: EditorSink | null): void {
  sink = s
}

/** 程序化写入（回退/恢复/导入等）——期间抑制编辑器的“用户输入”事件 */
export function setEditorText(text: string): void {
  lastSavedText = text
  if (sink) {
    suppressEvents = true
    try {
      sink.setText(text)
    } finally {
      suppressEvents = false
    }
  }
  updateCounts(text)
  st.saveKind = 'ok'
  st.saveMsg = '已恢复'
}

export function isSuppressingEvents(): boolean {
  return suppressEvents
}

function liveText(): string {
  return sink ? sink.getText() : lastSavedText
}

/* ---------------- 模块内部状态 ---------------- */
let lastSavedText = ''
let saveTimer: ReturnType<typeof setTimeout> | undefined
let lastSnapAt = 0
let lastQuotaAt = 0
let toastTimer: ReturnType<typeof setTimeout> | undefined
let toastSeq = 0
let bannerTimer: ReturnType<typeof setTimeout> | undefined

/* ---------------- 对外 reactive 状态 ---------------- */
export const st = reactive({
  ready: false,
  index: {} as Record<string, DocMeta>,
  currentId: null as string | null,
  saveKind: '' as '' | 'ok' | 'dirty' | 'err',
  saveMsg: '就绪',
  chars: 0,
  lines: 0,
  degraded: false,
  dark: false,
  sidebarOpen: false,
  historyOpen: false,
  toast: null as { seq: number; msg: string } | null,
  banner: null as Banner | null,
  quota: '',
  quotaWarn: false,
})

export const docs = computed<DocMeta[]>(() =>
  Object.values(st.index).sort((a, b) => b.updatedAt - a.updatedAt),
)
export const currentMeta = computed<DocMeta | null>(
  () => (st.currentId && st.index[st.currentId]) || null,
)
export const historyList = computed<Snap[]>(() =>
  st.currentId ? readHist(st.currentId) : [],
)

/* ---------------- 存储读写辅助 ---------------- */
function loadIndex(): Record<string, DocMeta> {
  try {
    const raw = rawGet(INDEX_KEY)
    return raw ? (JSON.parse(raw) as Record<string, DocMeta>) : {}
  } catch {
    return {}
  }
}
function commitIndex(): void {
  rawSet(INDEX_KEY, JSON.stringify(st.index))
}
function makeId(): string {
  return 'd' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}
function hashId(): string {
  const h = location.hash
  return h && h.length > 1 ? decodeURIComponent(h.slice(1)) : ''
}
function readHist(id: string): Snap[] {
  try {
    const raw = rawGet(histKey(id))
    return raw ? (JSON.parse(raw) as Snap[]) : []
  } catch {
    return []
  }
}
function addSnapshot(id: string, text: string): void {
  if (!text) return
  const h = readHist(id)
  const last = h[h.length - 1]
  if (last && last.c === text) return
  h.push({ t: Date.now(), c: text })
  let total = 0
  for (const s of h) total += s.c.length
  while (h.length > SNAP_MAX || total > SNAP_MAX_CHARS) {
    const gone = h.shift()
    total -= gone ? gone.c.length : 0
  }
  rawSet(histKey(id), JSON.stringify(h))
}

/** 供编辑组件在挂载后读取某篇草稿的正文（优先正文，其次上一次备份） */
export function contentOf(id: string | null | undefined): string {
  if (!id) return ''
  const text = rawGet(docKey(id))
  if (text !== null) return text
  const bak = rawGet(bakKey(id))
  return bak !== null ? bak : ''
}

/* ---------------- 计数 / 标题 ---------------- */
function updateCounts(text: string): void {
  st.chars = text.length
  st.lines = text ? text.split('\n').length : 0
}
function updateTitle(): void {
  const meta = st.currentId ? st.index[st.currentId] : null
  document.title = meta ? `${meta.title} — 临时草稿本` : '临时草稿本 · 自动保存'
}

/* ---------------- Toast / Banner ---------------- */
export function showToast(msg: string): void {
  const seq = ++toastSeq
  st.toast = { seq, msg }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    if (st.toast && st.toast.seq === seq) st.toast = null
  }, 2600)
}

export function dismissBanner(): void {
  const b = st.banner
  if (b?.ackKey) rawSet(b.ackKey, '1')
  st.banner = null
  clearTimeout(bannerTimer)
}

function showBanner(msg: string, kind: Banner['kind'], sticky: boolean, ackKey?: string): void {
  st.banner = { msg, kind, sticky, ackKey }
  clearTimeout(bannerTimer)
  if (!sticky) {
    bannerTimer = setTimeout(() => {
      if (st.banner && !st.banner.sticky) st.banner = null
    }, 8000)
  }
}

/* ---------------- 配额显示 ---------------- */
export function refreshQuota(force = false): void {
  const now = Date.now()
  if (!force && now - lastQuotaAt < 2000) return
  lastQuotaAt = now
  if (!isStoreOk()) {
    st.quota = ''
    st.quotaWarn = false
    return
  }
  try {
    let used = 0
    const keys = Object.keys(localStorage)
    for (const k of keys) {
      const v = localStorage.getItem(k)
      used += (k.length + (v ? v.length : 0)) * 2
    }
    const txt =
      used >= 1048576
        ? `${(used / 1048576).toFixed(2)} MB`
        : `${Math.round(used / 1024)} KB`
    st.quota = `本页源占用 ${txt}`
    st.quotaWarn = used > 4e6
  } catch {
    st.quota = ''
    st.quotaWarn = false
  }
}

/* ---------------- 自动保存核心 ---------------- */
export function persistNow(force = false): void {
  clearTimeout(saveTimer)
  const id = st.currentId
  if (!id) return
  const text = liveText()
  const changed = force || text !== lastSavedText
  if (!changed) {
    if (st.saveKind === 'dirty') {
      st.saveKind = 'ok'
      st.saveMsg = `已自动保存 ${timeHM()}`
    }
    return
  }

  // 双键轮换：写入前把上一版挪到 .bak，一次坏写不至于归零
  const prev = rawGet(docKey(id))
  if (prev !== null && prev !== text) rawSet(bakKey(id), prev)
  const res = rawSet(docKey(id), text)

  if (res === 'sess' || res === 'mem') {
    st.degraded = true
    showBanner(
      '⚠ localStorage 不可用或已写满，内容目前只暂存在浏览器会话中（关闭窗口会丢失）。' +
        '请「备份全部」导出，或到草稿列表删除旧草稿释放空间。',
      'error',
      true,
    )
  } else if (st.degraded) {
    st.degraded = false
    if (st.banner?.kind === 'error') dismissBanner()
  }

  lastSavedText = text
  if (Date.now() - lastSnapAt > SNAP_INTERVAL) {
    addSnapshot(id, text)
    lastSnapAt = Date.now()
  }

  const meta =
    st.index[id] ||
    (st.index[id] = { id, title: '未命名', createdAt: Date.now(), updatedAt: Date.now() })
  meta.updatedAt = Date.now()
  meta.title = titleOf(text)
  commitIndex()

  st.saveKind = 'ok'
  st.saveMsg = `已自动保存 ${timeHM()}`
  updateCounts(text)
  updateTitle()
  refreshQuota(true)
}

/** 编辑器监听到用户输入时回调 */
export function onUserInput(text: string): void {
  st.saveKind = 'dirty'
  st.saveMsg = '自动保存中…'
  updateCounts(text)
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => persistNow(), SAVE_DEBOUNCE)
}

/** 编辑器挂载、内容就绪后由组件调用 */
export function onEditorReady(): void {
  const text = liveText()
  lastSavedText = text
  lastSnapAt = Date.now()
  addSnapshot(st.currentId!, text)
  st.saveKind = 'ok'
  st.saveMsg = text ? '已从本地恢复' : '空白草稿'
  updateCounts(text)
  updateTitle()
  refreshQuota(true)
}

/* ---------------- 文档操作 ---------------- */
export function createNewDoc(): void {
  persistNow()
  const id = makeId()
  st.index[id] = { id, title: '未命名', createdAt: Date.now(), updatedAt: Date.now() }
  st.currentId = id
  history.replaceState(null, '', '#' + encodeURIComponent(id))
  commitIndex()
  showToast('已新建一篇空白草稿')
}

export function switchToDoc(id: string, opts?: { keepHash?: boolean }): void {
  if (id === st.currentId) return
  persistNow()
  if (!st.index[id]) {
    st.index[id] = { id, title: '未命名', createdAt: Date.now(), updatedAt: Date.now() }
    commitIndex()
  }
  st.currentId = id
  if (!opts?.keepHash) history.replaceState(null, '', '#' + encodeURIComponent(id))
  st.sidebarOpen = false
}

export function deleteDoc(id: string): void {
  const meta = st.index[id]
  const title = meta?.title ?? '未命名'
  if (!window.confirm(`删除草稿「${title}」？\n正文、历史快照将一并删除，无法恢复（除非导出过备份）。`)) {
    return
  }
  rawDel(docKey(id))
  rawDel(bakKey(id))
  rawDel(histKey(id))
  delete st.index[id]
  if (id === st.currentId) {
    // 删除当前草稿 → 新开一篇空白稿，避免把旧内容写回已删除的键
    const fresh = makeId()
    st.index[fresh] = { id: fresh, title: '未命名', createdAt: Date.now(), updatedAt: Date.now() }
    st.currentId = fresh
    history.replaceState(null, '', '#' + encodeURIComponent(fresh))
    commitIndex()
    showToast(`已删除「${title}」，并新开一篇空白草稿`)
  } else {
    commitIndex()
    showToast(`已删除「${title}」`)
  }
  refreshQuota(true)
}

export function undoOneStep(): void {
  const id = st.currentId
  if (!id) return
  persistNow() // 先把当前编辑状态落盘
  const cur = rawGet(docKey(id))
  const bak = rawGet(bakKey(id))
  if (bak === null) {
    showToast('暂无更早的版本可回退')
    return
  }
  if (cur !== null) rawSet(bakKey(id), cur) // 当前版进入“重做位”
  rawSet(docKey(id), bak) // 旧版成为当前内容并真正持久化
  setEditorText(bak)
  st.index[id].updatedAt = Date.now()
  commitIndex()
  st.saveMsg = '已回退，可再点一次换回'
  refreshQuota(true)
  showToast('已回退到上一次自动保存的版本（可再点一次换回）')
}

export function restoreSnapshot(ts: number): void {
  const id = st.currentId
  if (!id) return
  const snaps = readHist(id)
  const s = snaps.find((x) => x.t === ts)
  if (!s) return
  setEditorText(s.c)
  persistNow(true) // 恢复版本强制写回主键，当前版本自动转入“回退一步”的重做位
  st.historyOpen = false
  showToast(`已恢复到 ${fmtFull(ts).slice(11)} 的版本`)
}

/* ---------------- 导入导出 ---------------- */
export function exportCurrentTxt(): void {
  persistNow()
  const text = liveText()
  if (!text) {
    showToast('当前草稿为空，没有可导出的内容')
    return
  }
  const meta = st.currentId ? st.index[st.currentId] : null
  const name = `草稿-${safeName(meta?.title ?? 'untitled')}-${fmtStamp(Date.now())}.txt`
  downloadText(name, text)
  showToast(`已导出 ${name}`)
}

export function backupAll(): void {
  persistNow()
  const ids = Object.keys(st.index)
  if (!ids.length) {
    showToast('还没有任何草稿')
    return
  }
  const docs = ids.map((id) => ({
    id,
    title: st.index[id].title,
    createdAt: st.index[id].createdAt,
    updatedAt: st.index[id].updatedAt,
    content: rawGet(docKey(id)) ?? '',
  }))
  const payload = { app: 'dsh-scratch', version: 1, exportedAt: Date.now(), docs }
  const name = `草稿本备份-${fmtStamp(Date.now())}.json`
  downloadBlob(name, new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }))
  showToast(`已备份 ${docs.length} 篇草稿`)
}

export function importBackupFile(file: File): void {
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result))
      if (!data || data.app !== 'dsh-scratch' || !Array.isArray(data.docs)) {
        throw new Error('bad format')
      }
      let added = 0
      let updated = 0
      let skipped = 0
      let currentChanged = false
      let currentContent = ''
      for (const d of data.docs as { id?: unknown }[]) {
        if (!d || typeof d.id !== 'string') continue
        const raw = d as { id: string; title?: string; createdAt?: number; updatedAt?: number; content?: unknown }
        const local = st.index[raw.id]
        const content = typeof raw.content === 'string' ? raw.content : ''
        if (!local) {
          st.index[raw.id] = {
            id: raw.id,
            title: raw.title || '未命名',
            createdAt: raw.createdAt || Date.now(),
            updatedAt: raw.updatedAt || Date.now(),
          }
          rawSet(docKey(raw.id), content)
          added++
        } else if ((raw.updatedAt || 0) > (local.updatedAt || 0)) {
          local.title = raw.title || local.title
          local.updatedAt = raw.updatedAt || local.updatedAt
          rawSet(docKey(raw.id), content)
          updated++
          if (raw.id === st.currentId) {
            currentChanged = true
            currentContent = content
          }
        } else {
          skipped++
        }
      }
      commitIndex()
      refreshQuota(true)
      if (currentChanged) setEditorText(currentContent)
      showToast(`导入完成：新增 ${added} 篇，更新 ${updated} 篇，跳过 ${skipped} 篇`)
    } catch {
      showToast('导入失败：文件格式不正确')
    }
  }
  reader.readAsText(file)
}

/* ---------------- 主题 ---------------- */
function loadUiPref(): { dark: boolean } {
  try {
    const raw = rawGet(UI_KEY)
    if (raw) {
      const p = JSON.parse(raw) as { dark?: unknown }
      if (typeof p.dark === 'boolean') return { dark: p.dark }
    }
  } catch {
    /* 忽略 */
  }
  const sys = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  return { dark: !!sys }
}
function applyThemeClass(): void {
  document.documentElement.classList.toggle('dark', st.dark)
}
export function toggleDark(): void {
  st.dark = !st.dark
  rawSet(UI_KEY, JSON.stringify({ dark: st.dark }))
  applyThemeClass()
}

/* ---------------- 面板开关 ---------------- */
export function toggleSidebar(): void {
  st.sidebarOpen = !st.sidebarOpen
}
export function closeSidebar(): void {
  st.sidebarOpen = false
}
export function openHistory(): void {
  if (st.currentId) st.historyOpen = true
  else showToast('还没有草稿')
}
export function closeHistory(): void {
  st.historyOpen = false
}

/* ---------------- 全局事件 ---------------- */
function onHashChange(): void {
  const h = hashId()
  if (h && st.index[h]) switchToDoc(h, { keepHash: true })
  else if (!h && st.currentId) createNewDoc()
}
function onVisibility(): void {
  if (document.visibilityState === 'hidden') persistNow()
}
function onKeyDown(e: KeyboardEvent): void {
  if (e.defaultPrevented) return
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    persistNow()
    showToast(`无需手动保存：已自动保存于 ${timeHM()}`)
  }
}

/* ---------------- 初始化 ---------------- */
export function init(): void {
  if (st.ready) return
  detectStore()
  st.index = loadIndex()
  st.dark = loadUiPref().dark
  applyThemeClass()

  if (!isStoreOk()) {
    showBanner(
      '⚠ 此浏览器当前不允许持久化存储（localStorage 不可用，常见于部分隐私模式或受限环境）。' +
        '内容仍会自动保存，但只在本页会话内有效，关闭页面即丢失。请尽快「备份全部」到本地文件。',
      'error',
      true,
    )
  } else if (location.protocol === 'file:' && !rawGet(HINT_KEY)) {
    showBanner(
      '已开启自动保存。首次使用请自测：输入几行文字 → 按 F5 刷新 → 内容应原样保留。' +
        '若刷新后变空，说明该浏览器在 file:// 打开方式下不持久化 localStorage，' +
        '请改用本地 http 服务打开（如 npm run dev / npm run preview）。',
      'info',
      true,
      HINT_KEY,
    )
  }

  const h = hashId()
  if (h && st.index[h]) {
    switchToDoc(h, { keepHash: true })
  } else {
    createNewDoc()
  }
  refreshQuota(true)
  st.ready = true

  window.addEventListener('hashchange', onHashChange)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', () => persistNow())
  window.addEventListener('beforeunload', () => persistNow())
  window.addEventListener('keydown', onKeyDown)
}

// 便于测试与调试
export { fmtRel }
