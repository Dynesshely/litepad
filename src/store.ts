/**
 * 全局状态与核心逻辑（无外部依赖的单例 store，供组件以 reactive 方式订阅）。
 * 职责：文档模型、自动保存（防抖 + 关页 flush + 双键轮换 + 历史快照）、
 *       配额降级、导入导出、主题、抽屉/弹层开关。
 */
import { computed, reactive } from 'vue'
import { detectLocale, isLocaleId, locale, setLocale, t } from './lib/i18n'
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
import { downloadBlob, downloadBytes } from './lib/download'
import {
  DEFAULT_ENCODING,
  countUnmappable,
  decodeBytes,
  encodeTextDetailed,
  encodingLabel,
  getEncodingDef,
  mimeCharset,
} from './lib/encoding'

export interface DocMeta {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  /** 该草稿用于导出/导入 .txt 的文本编码（缺省视为 UTF-8） */
  encoding?: string
  /** 列表中的手动排序位置（越小越靠前；缺失时按 updatedAt 兜底） */
  order?: number
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
  setSave('ok', 'st.recovered')
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
  /** 状态栏保存文案的 i18n key + 可选时间戳：在 UI 层翻译，切换语言即刻生效 */
  saveKey: 'st.ready',
  saveAt: null as number | null,
  chars: 0,
  lines: 0,
  degraded: false,
  dark: false,
  sidebarOpen: false,
  /** 草稿列表是否固定为左侧常驻面板（全高） */
  sidebarPinned: false,
  historyOpen: false,
  /** 「关于 Litepad」弹窗 */
  aboutOpen: false,
  toast: null as { seq: number; msg: string } | null,
  banner: null as Banner | null,
  quota: '',
  /** 仅供「关于」页展示的纯数值（如 “12 KB”），与状态栏的整句文案分开 */
  quotaSize: '',
  quotaWarn: false,
})

export const docs = computed<DocMeta[]>(() =>
  Object.values(st.index).sort(
    (a, b) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
      b.updatedAt - a.updatedAt,
  ),
)
export const currentMeta = computed<DocMeta | null>(
  () => (st.currentId && st.index[st.currentId]) || null,
)
export const historyList = computed<Snap[]>(() =>
  st.currentId ? readHist(st.currentId) : [],
)
/** 当前草稿的文本编码 */
export const currentEncoding = computed<string>(() => encodingOf(st.currentId))

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
/** 新草稿默认排在列表最前：order 取当前最小值 - 1 */
function nextTopOrder(): number {
  const orders = Object.values(st.index).map((m) => m.order ?? 0)
  return orders.length ? Math.min(...orders) - 1 : 0
}
function newMeta(id: string, title?: string): DocMeta {
  const now = Date.now()
  return {
    id,
    title: title ?? t('doc.untitled'),
    createdAt: now,
    updatedAt: now,
    order: nextTopOrder(),
  }
}
/** 老数据没有 order 字段时，按「最近更新优先」补一份初始顺序 */
function normalizeOrder(): void {
  const metas = Object.values(st.index)
  if (!metas.length || metas.every((m) => typeof m.order === 'number')) return
  metas
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .forEach((m, i) => {
      m.order = i
    })
  commitIndex()
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
  document.title = meta ? t('app.docTitle', { title: meta.title }) : t('app.titleAuto')
}

function setSave(kind: '' | 'ok' | 'dirty' | 'err', key: string, at: number | null = null): void {
  st.saveKind = kind
  st.saveKey = key
  st.saveAt = at
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
    st.quotaSize = ''
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
    st.quotaSize = txt
    st.quota = used > 4e6 ? t('st.quotaFull', { size: txt }) : t('st.quota', { size: txt })
    st.quotaWarn = used > 4e6
  } catch {
    st.quota = ''
    st.quotaSize = ''
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
      setSave('ok', 'st.saved', Date.now())
    }
    return
  }

  // 双键轮换：写入前把上一版挪到 .bak，一次坏写不至于归零
  const prev = rawGet(docKey(id))
  if (prev !== null && prev !== text) rawSet(bakKey(id), prev)
  const res = rawSet(docKey(id), text)

  if (res === 'sess' || res === 'mem') {
    st.degraded = true
    showBanner(t('banner.degraded'), 'error', true)
  } else if (st.degraded) {
    st.degraded = false
    if (st.banner?.kind === 'error') dismissBanner()
  }

  lastSavedText = text
  if (Date.now() - lastSnapAt > SNAP_INTERVAL) {
    addSnapshot(id, text)
    lastSnapAt = Date.now()
  }

  const meta = st.index[id] || (st.index[id] = newMeta(id))
  meta.updatedAt = Date.now()
  meta.title = titleOf(text)
  commitIndex()

  setSave('ok', 'st.saved', Date.now())
  updateCounts(text)
  updateTitle()
  refreshQuota(true)
}

/** 编辑器监听到用户输入时回调 */
export function onUserInput(text: string): void {
  setSave('dirty', 'st.saving')
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
  setSave('ok', text ? 'st.restored' : 'st.emptyDraft')
  updateCounts(text)
  updateTitle()
  refreshQuota(true)
}

/* ---------------- 文档操作 ---------------- */
export function createNewDoc(): void {
  persistNow()
  const id = makeId()
  st.index[id] = newMeta(id)
  st.currentId = id
  history.replaceState(null, '', '#' + encodeURIComponent(id))
  commitIndex()
  showToast(t('toast.newDraft'))
}

/** 拖动排序：把 draggedId 放到列表的第 targetIndex 个位置（0 基） */
export function reorderDocs(draggedId: string, targetIndex: number): void {
  const ids = docs.value.map((d) => d.id)
  const from = ids.indexOf(draggedId)
  if (from < 0) return
  ids.splice(from, 1)
  const to = Math.max(0, Math.min(targetIndex, ids.length))
  ids.splice(to, 0, draggedId)
  ids.forEach((id, i) => {
    const meta = st.index[id]
    if (meta) meta.order = i
  })
  commitIndex()
  showToast(t('list.moved'))
}

/** 放弃手动顺序，恢复为「最近更新优先」 */
export function sortDocsByRecent(): void {
  Object.values(st.index)
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .forEach((meta, i) => {
      meta.order = i
    })
  commitIndex()
  showToast(t('list.reordered'))
}

export function switchToDoc(id: string, opts?: { keepHash?: boolean }): void {
  if (id === st.currentId) return
  persistNow()
  if (!st.index[id]) {
    st.index[id] = newMeta(id)
    commitIndex()
  }
  st.currentId = id
  if (!opts?.keepHash) history.replaceState(null, '', '#' + encodeURIComponent(id))
  st.sidebarOpen = false
}

export function deleteDoc(id: string): void {
  const meta = st.index[id]
  const title = meta?.title ?? t('doc.untitled')
  if (!window.confirm(t('confirm.delete', { title }))) {
    return
  }
  rawDel(docKey(id))
  rawDel(bakKey(id))
  rawDel(histKey(id))
  delete st.index[id]
  if (id === st.currentId) {
    // 删除当前草稿 → 新开一篇空白稿，避免把旧内容写回已删除的键
    const fresh = makeId()
    st.index[fresh] = newMeta(fresh)
    st.currentId = fresh
    history.replaceState(null, '', '#' + encodeURIComponent(fresh))
    commitIndex()
    showToast(t('toast.deletedAndNew', { title }))
  } else {
    commitIndex()
    showToast(t('toast.deleted', { title }))
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
    showToast(t('toast.noOlder'))
    return
  }
  if (cur !== null) rawSet(bakKey(id), cur) // 当前版进入“重做位”
  rawSet(docKey(id), bak) // 旧版成为当前内容并真正持久化
  setEditorText(bak)
  st.index[id].updatedAt = Date.now()
  commitIndex()
  setSave('ok', 'st.undone')
  refreshQuota(true)
  showToast(t('toast.rolledBack'))
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
  showToast(t('toast.snapshotRestored', { time: fmtFull(ts).slice(11) }))
}

/* ---------------- 文本编码（每篇草稿独立） ---------------- */
export function encodingOf(id: string | null | undefined): string {
  const meta = id ? st.index[id] : null
  return meta?.encoding || DEFAULT_ENCODING
}

function applyEncodingMeta(id: string, enc: string): void {
  const meta = st.index[id]
  if (!meta) return
  meta.encoding = enc
  commitIndex()
}

/** 切换当前草稿的编码（只影响导出/导入的字节解读，正文不变） */
export function setCurrentEncoding(enc: string): void {
  const id = st.currentId
  if (!id) return
  const def = getEncodingDef(enc)
  const text = liveText()
  applyEncodingMeta(id, def.id)
  const bad = countUnmappable(text, def.id)
  if (bad > 0) {
    showToast(t('enc.setWarn', { enc: def.label, n: bad }))
  } else {
    showToast(t('enc.set', { enc: def.label }))
  }
}

/** 按当前草稿的编码导入 .txt（文件中带 BOM 时以 BOM 为准） */
export function importTextFile(file: File): void {
  const id = st.currentId
  if (!id) return
  const def = getEncodingDef(encodingOf(id))
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const bytes = new Uint8Array(reader.result as ArrayBuffer)
      const res = decodeBytes(bytes, def.id)
      const label = encodingLabel(res.encoding)
      if (!window.confirm(t('enc.importConfirm', { enc: label, file: file.name, size: bytes.length }))) {
        return
      }
      setEditorText(res.text)
      persistNow(true)
      if (res.encoding !== def.id) applyEncodingMeta(id, res.encoding) // 跟随 BOM 校正草稿编码
      refreshQuota(true)
      showToast(
        t('enc.imported', {
          enc: label,
          file: file.name,
          bom: res.detectedBom ? t('enc.importedBom') : '',
          chars: res.text.length,
        }),
      )
    } catch {
      showToast(t('enc.importFailed'))
    }
  }
  reader.readAsArrayBuffer(file)
}

/* ---------------- 导入导出 ---------------- */
export function exportCurrentTxt(): void {
  persistNow()
  const id = st.currentId
  const text = liveText()
  if (!text) {
    showToast(t('enc.exportEmpty'))
    return
  }
  const def = getEncodingDef(encodingOf(id))
  const { bytes, unmappable } = encodeTextDetailed(text, def.id)
  const meta = id ? st.index[id] : null
  const name = `草稿-${safeName(meta?.title ?? 'untitled')}-${fmtStamp(Date.now())}.txt`
  downloadBytes(name, bytes, `text/plain;charset=${mimeCharset(def.id)}`)
  const warn = unmappable ? t('enc.exportedWarn', { n: unmappable, enc: def.label }) : ''
  showToast(t('enc.exported', { enc: def.label, name, size: bytes.length }) + warn)
}

export function backupAll(): void {
  persistNow()
  const ids = Object.keys(st.index)
  if (!ids.length) {
    showToast(t('toast.noDrafts'))
    return
  }
  const docs = ids.map((id) => ({
    id,
    title: st.index[id].title,
    createdAt: st.index[id].createdAt,
    updatedAt: st.index[id].updatedAt,
    encoding: st.index[id].encoding || DEFAULT_ENCODING,
    order: st.index[id].order ?? 0,
    content: rawGet(docKey(id)) ?? '',
  }))
  const payload = { app: 'dsh-scratch', version: 1, exportedAt: Date.now(), docs }
  const name = `草稿本备份-${fmtStamp(Date.now())}.json`
  downloadBlob(name, new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }))
  showToast(t('toast.backedUp', { n: docs.length }))
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
        const raw = d as {
          id: string
          title?: string
          createdAt?: number
          updatedAt?: number
          encoding?: unknown
          order?: number
          content?: unknown
        }
        const local = st.index[raw.id]
        const content = typeof raw.content === 'string' ? raw.content : ''
        const enc = typeof raw.encoding === 'string' ? raw.encoding : DEFAULT_ENCODING
        if (!local) {
          st.index[raw.id] = {
            id: raw.id,
            title: raw.title || t('doc.untitled'),
            createdAt: raw.createdAt || Date.now(),
            updatedAt: raw.updatedAt || Date.now(),
            encoding: enc,
            order: raw.order ?? nextTopOrder(),
          }
          rawSet(docKey(raw.id), content)
          added++
        } else if ((raw.updatedAt || 0) > (local.updatedAt || 0)) {
          local.title = raw.title || local.title
          local.updatedAt = raw.updatedAt || local.updatedAt
          local.encoding = enc
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
      showToast(t('toast.importSummary', { added, updated, skipped }))
    } catch {
      showToast(t('toast.importBadFormat'))
    }
  }
  reader.readAsText(file)
}

/* ---------------- 主题、语言与界面偏好 ---------------- */
interface UiPref {
  dark: boolean
  sidebarPinned: boolean
  locale: string
}

function loadUiPref(): UiPref {
  let dark: boolean | null = null
  let sidebarPinned = false
  let loc = ''
  try {
    const raw = rawGet(UI_KEY)
    if (raw) {
      const p = JSON.parse(raw) as { dark?: unknown; sidebarPinned?: unknown; locale?: unknown }
      if (typeof p.dark === 'boolean') dark = p.dark
      if (typeof p.sidebarPinned === 'boolean') sidebarPinned = p.sidebarPinned
      if (isLocaleId(p.locale)) loc = p.locale
    }
  } catch {
    /* 忽略 */
  }
  if (dark === null) {
    dark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
  }
  return { dark, sidebarPinned, locale: loc || detectLocale() }
}

function saveUiPref(): void {
  rawSet(
    UI_KEY,
    JSON.stringify({ dark: st.dark, sidebarPinned: st.sidebarPinned, locale: locale.value }),
  )
}

function applyThemeClass(): void {
  document.documentElement.classList.toggle('dark', st.dark)
}

export function toggleDark(): void {
  st.dark = !st.dark
  applyThemeClass()
  saveUiPref()
}

/** 切换界面语言（工具栏主题按钮左侧入口） */
export function changeLocale(id: string): void {
  setLocale(id)
  saveUiPref()
  updateTitle()
  refreshQuota(true)
}

/* ---------------- 面板开关 ---------------- */
/** 固定为左侧全高常驻面板 */
export function pinSidebar(): void {
  st.sidebarPinned = true
  st.sidebarOpen = false
  saveUiPref()
  showToast(t('toast.pinned'))
}
export function unpinSidebar(): void {
  st.sidebarPinned = false
  saveUiPref()
}
export function toggleSidebar(): void {
  if (st.sidebarPinned) {
    unpinSidebar()
    return
  }
  st.sidebarOpen = !st.sidebarOpen
}
export function closeSidebar(): void {
  st.sidebarOpen = false
}
export function openHistory(): void {
  if (st.currentId) st.historyOpen = true
  else showToast(t('toast.historyNoDraft'))
}
export function closeHistory(): void {
  st.historyOpen = false
}

/* ---------------- 关于 ---------------- */
export function openAbout(): void {
  st.aboutOpen = true
  refreshQuota(true)
}
export function closeAbout(): void {
  st.aboutOpen = false
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
    showToast(t('toast.noManualSaveAt', { time: timeHM() }))
  }
}

/* ---------------- 初始化 ---------------- */
export function init(): void {
  if (st.ready) return
  detectStore()
  st.index = loadIndex()
  const pref = loadUiPref()
  st.dark = pref.dark
  st.sidebarPinned = pref.sidebarPinned
  setLocale(pref.locale)
  normalizeOrder()
  applyThemeClass()

  if (!isStoreOk()) {
    showBanner(t('banner.noStorage'), 'error', true)
  } else if (location.protocol === 'file:' && !rawGet(HINT_KEY)) {
    showBanner(t('banner.fileHint'), 'info', true, HINT_KEY)
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
