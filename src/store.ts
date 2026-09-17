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
import { commandTitle, findCommand, type TextTarget } from './lib/commands'
import { normalizeEol } from './lib/textOps'
import { idbAvailable, idbDelete, idbGet, idbPut } from './lib/idb'
import { downloadBlob, downloadBytes } from './lib/download'
import { AUTO_LANG, PLAINTEXT, detectLang } from './lib/languages'
import { isKnownLang, langLabel } from './lib/langRegistry'
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
  /** 代码着色使用的语言（Monaco 语言 id，或 `auto` 表示按内容自动检测；缺省 auto） */
  lang?: string
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
const LANG_DETECT_DEBOUNCE = 500 // 自动检测模式下重算语言的节流间隔

/* ---------------- 编辑器桥接（由 MonacoEditor.vue 注册） ---------------- */
export interface EditorSink {
  getText(): string
  setText(text: string): void
  /** 当前选区/光标所在的文本快照，供命令菜单使用 */
  getTarget(): TextTarget
  /** 单步替换一段范围（走编辑器 undo 栈，可被一次 Ctrl+Z 撤销） */
  replaceRange(start: number, end: number, text: string): void
  /** 选中一段范围（不修改内容） */
  selectRange(start: number, end: number): void
  /** 跳转并把光标放到指定行（1 基） */
  goToLine(line: number): void
  /** 让编辑器重新获得焦点 */
  focus(): void
}
let sink: EditorSink | null = null
let suppressEvents = false
/** 输入型弹框的提交回调（不放进 reactive，避免被代理） */
let pendingPromptSubmit: ((value: string) => void) | null = null

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
  /** 命令菜单 */
  paletteOpen: false,
  /** 设置弹窗 */
  settingsOpen: false,
  /** 底栏代码语言选择菜单 */
  langMenuOpen: false,
  /** 当前草稿实际生效的 Monaco 语言 id（自动检测模式下由内容推断） */
  resolvedLang: PLAINTEXT,
  /** 外观（背景图片存 IndexedDB，仅把 objectURL 放在内存里） */
  appearance: {
    imageUrl: '',
    /** 是否已设置壁纸（同步持久化，用于首屏在 IndexedDB 读完前就切好半透明表面，避免闪一下不透明底色） */
    hasImage: false,
    /** 图片可见度（0–100，越低遮罩越强） */
    opacity: 60,
    /** 背景图模糊度（px） */
    blur: 0,
    /** 壁纸下是否给编辑区留一层淡底色（默认关：编辑区完全透出壁纸） */
    editorTint: false,
  },
  /** 命令参数输入 / 信息展示弹框 */
  dialog: {
    open: false,
    mode: 'input' as 'input' | 'info',
    title: '',
    label: '',
    placeholder: '',
    value: '',
    rows: [] as { label: string; value: string }[],
  },
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

/** 当前草稿的语言**模式**（可能是 `auto` 自动检测） */
export const currentLang = computed<string>(() => langOf(st.currentId))

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
  // 归一化换行后再统计，避免 CRLF 文本把 \r 也计入字符数
  const normalized = normalizeEol(text)
  st.chars = normalized.length
  st.lines = normalized ? normalized.split('\n').length : 0
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
  scheduleLangDetect(text)
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
  st.langMenuOpen = false
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
  bgOpacity: number
  bgBlur: number
  /** 是否已设置壁纸（同步标记，让首屏在 IndexedDB 读完前就切好透明根背景） */
  hasBg: boolean
  /** 壁纸下编辑区是否保留淡底色 */
  editorTint: boolean
}

function loadUiPref(): UiPref {
  let dark: boolean | null = null
  let sidebarPinned = false
  let loc = ''
  let bgOpacity = 60
  let bgBlur = 0
  let hasBg = false
  let editorTint = false
  try {
    const raw = rawGet(UI_KEY)
    if (raw) {
      const p = JSON.parse(raw) as {
        dark?: unknown
        sidebarPinned?: unknown
        locale?: unknown
        bgOpacity?: unknown
        bgBlur?: unknown
        hasBg?: unknown
        editorTint?: unknown
      }
      if (typeof p.dark === 'boolean') dark = p.dark
      if (typeof p.sidebarPinned === 'boolean') sidebarPinned = p.sidebarPinned
      if (isLocaleId(p.locale)) loc = p.locale
      if (typeof p.bgOpacity === 'number') bgOpacity = Math.max(0, Math.min(100, p.bgOpacity))
      if (typeof p.bgBlur === 'number') bgBlur = Math.max(0, Math.min(40, p.bgBlur))
      if (typeof p.hasBg === 'boolean') hasBg = p.hasBg
      if (typeof p.editorTint === 'boolean') editorTint = p.editorTint
    }
  } catch {
    /* 忽略 */
  }
  if (dark === null) {
    dark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
  }
  return { dark, sidebarPinned, locale: loc || detectLocale(), bgOpacity, bgBlur, hasBg, editorTint }
}

function saveUiPref(): void {
  rawSet(
    UI_KEY,
    JSON.stringify({
      dark: st.dark,
      sidebarPinned: st.sidebarPinned,
      locale: locale.value,
      bgOpacity: st.appearance.opacity,
      bgBlur: st.appearance.blur,
      hasBg: st.appearance.hasImage,
      editorTint: st.appearance.editorTint,
    }),
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

/* ---------------- 命令菜单 ---------------- */
export function openPalette(): void {
  if (!st.currentId) return
  st.paletteOpen = true
  st.dialog.open = false
  st.aboutOpen = false
  st.historyOpen = false
  st.langMenuOpen = false
}
export function closePalette(): void {
  st.paletteOpen = false
}
export function togglePalette(): void {
  if (st.paletteOpen) closePalette()
  else openPalette()
}

/** 输入型弹框（命令需要参数时） */
export function openPrompt(opts: { title: string; label: string; placeholder?: string; value?: string }, onSubmit: (value: string) => void): void {
  pendingPromptSubmit = onSubmit
  st.dialog = {
    open: true,
    mode: 'input',
    title: opts.title,
    label: opts.label,
    placeholder: opts.placeholder ?? '',
    value: opts.value ?? '',
    rows: [],
  }
}
export function submitPrompt(): void {
  const value = st.dialog.value
  const submit = pendingPromptSubmit
  closeDialog()
  if (submit) submit(value)
}
export function cancelPrompt(): void {
  closeDialog()
}
/** 信息型弹框（只读命令的结果展示） */
export function openInfo(title: string, rows: { label: string; value: string }[]): void {
  pendingPromptSubmit = null
  st.dialog = { open: true, mode: 'info', title, label: '', placeholder: '', value: '', rows }
}
export function closeDialog(): void {
  pendingPromptSubmit = null
  st.dialog.open = false
}

function targetOf(): TextTarget | null {
  if (!sink) return null
  return sink.getTarget()
}

/** 执行一条命令：解析作用范围 → 变换 → 单步替换（或弹框/信息框） */
export function runCommandById(id: string, arg?: string): void {
  const def = findCommand(id)
  if (!def) return
  const title = commandTitle(def)
  const target = targetOf()
  if (!target) {
    showToast(t('cmd.noEditor'))
    return
  }

  if (def.kind === 'info') {
    const res = def.run(target)
    openInfo(t(res.titleKey), res.rows)
    return
  }

  // 参数来源：选区优先（如「单行转多行」以选中文本作分隔符），否则弹框输入
  if (def.kind === 'action') {
    if (def.prompt && arg === undefined) {
      openPrompt(
        {
          title: t(def.prompt.titleKey),
          label: t(def.prompt.labelKey),
          placeholder: def.prompt.placeholderKey ? t(def.prompt.placeholderKey) : '',
          value: def.prompt.defaultValue ?? '',
        },
        (value) => runCommandById(id, value),
      )
      return
    }
    try {
      def.run({
        target,
        value: arg ?? '',
        goToLine: (line) => sink?.goToLine(line),
        openSettings: () => openSettings(),
        openLangMenu: () => openLangMenu(),
      })
    } catch (err) {
      showToast(t('cmd.error', { title, msg: String(err) }))
    }
    return
  }

  let value = arg
  if (value === undefined && def.argFromSelection && target.hasSelection) {
    value = target.selected
  }
  if (value === undefined && def.prompt) {
    openPrompt(
      {
        title: t(def.prompt.titleKey),
        label: t(def.prompt.labelKey),
        placeholder: def.prompt.placeholderKey ? t(def.prompt.placeholderKey) : '',
        value: def.prompt.defaultValue ?? '',
      },
      (v) => runCommandById(id, v),
    )
    return
  }

  const pick = (): { start: number; end: number; text: string } => {
    if (def.scope === 'whole') return { start: 0, end: target.full.length, text: target.full }
    if (def.scope === 'lines') {
      // 无选区时作用于整篇：否则「删除空行 / 排序 / 去重」这类命令只处理光标所在的一行，看起来无效
      return target.hasSelection
        ? { start: target.lineStart, end: target.lineEnd, text: target.lineText }
        : { start: 0, end: target.full.length, text: target.full }
    }
    return target.hasSelection
      ? { start: target.selectionStart, end: target.selectionEnd, text: target.selected }
      : { start: 0, end: target.full.length, text: target.full }
  }
  const range = pick()
  try {
    const out = def.transform(range.text, value ?? '')
    if (out === range.text) return
    suppressEvents = true
    try {
      sink?.replaceRange(range.start, range.end, out)
    } finally {
      suppressEvents = false
    }
    // 命令替换同样应触发自动保存（手动投递一次输入事件）
    onUserInput(sink?.getText() ?? '')
    showToast(t('cmd.applied', { title }))
  } catch (err) {
    suppressEvents = false
    const msg = err instanceof Error ? err.message : String(err)
    showToast(t('cmd.error', { title, msg }))
  }
}

/* ---------------- 设置弹窗 ---------------- */
export function openSettings(): void {
  st.langMenuOpen = false
  st.settingsOpen = true
  st.paletteOpen = false
  st.dialog.open = false
  st.aboutOpen = false
  st.historyOpen = false
  refreshQuota(true)
}
export function closeSettings(): void {
  st.settingsOpen = false
}
export function toggleSettings(): void {
  if (st.settingsOpen) closeSettings()
  else openSettings()
}

/* ---------------- 外观：背景图片（IndexedDB） ---------------- */
const BG_KEY = 'appearance.background'
const BG_MAX_BYTES = 8 * 1024 * 1024
let bgObjectUrl: string | null = null

function syncBackgroundClass(): void {
  // 把「是否有壁纸」挂到 <html> 上，与 .dark 同层，CSS 变量据此切换半透明表面与透明根背景
  const hasBg = !!(st.appearance.imageUrl || st.appearance.hasImage)
  document.documentElement.classList.toggle('has-bg', hasBg)
  // 底色只在壁纸下有意义；没有壁纸时编辑区本来就用主题色
  document.documentElement.classList.toggle('editor-tint', hasBg && st.appearance.editorTint)
}

/** 记录/清除「已设置壁纸」标记（同步写 localStorage，供下次首屏立即生效） */
function markBackgroundPresent(present: boolean): void {
  st.appearance.hasImage = present
  syncBackgroundClass()
  saveUiPref()
}

function applyBackgroundBlob(blob: Blob): void {
  if (bgObjectUrl) URL.revokeObjectURL(bgObjectUrl)
  bgObjectUrl = URL.createObjectURL(blob)
  st.appearance.imageUrl = bgObjectUrl
  markBackgroundPresent(true)
}

/** 启动时把上次保存的背景图从 IndexedDB 读回（objectURL 仅存活于当前会话） */
export async function loadBackgroundImage(): Promise<void> {
  if (!(await idbAvailable())) return
  const blob = await idbGet<Blob>(BG_KEY)
  if (blob instanceof Blob) applyBackgroundBlob(blob)
  else if (st.appearance.hasImage) {
    // 标记为有壁纸但 IndexedDB 里已不存在（例如换浏览器/被清理）：回收标记，避免一直用半透明表面
    st.appearance.hasImage = false
    syncBackgroundClass()
    saveUiPref()
  }
}

export async function setBackgroundImage(file: File): Promise<void> {
  if (!file.type.startsWith('image/')) {
    showToast(t('settings.imageInvalid'))
    return
  }
  if (file.size > BG_MAX_BYTES) {
    showToast(t('settings.imageTooLarge', { size: '8 MB' }))
    return
  }
  if (!(await idbAvailable()) || !(await idbPut(BG_KEY, file))) {
    showToast(t('settings.unavailable'))
    return
  }
  applyBackgroundBlob(file)
  showToast(t('settings.imageSaved'))
}

export async function clearBackgroundImage(): Promise<void> {
  await idbDelete(BG_KEY)
  if (bgObjectUrl) {
    URL.revokeObjectURL(bgObjectUrl)
    bgObjectUrl = null
  }
  st.appearance.imageUrl = ''
  markBackgroundPresent(false)
  showToast(t('settings.imageCleared'))
}

export function setBackgroundOpacity(value: number): void {
  st.appearance.opacity = Math.max(0, Math.min(100, Math.round(value)))
  saveUiPref()
}

/** 壁纸下编辑区是否保留一层淡底色（关 → 完全透出壁纸） */
export function setEditorTint(value: boolean): void {
  st.appearance.editorTint = value
  syncBackgroundClass()
  saveUiPref()
}

export function setBackgroundBlur(value: number): void {
  st.appearance.blur = Math.max(0, Math.min(40, Math.round(value)))
  saveUiPref()
}

export function setDark(value: boolean): void {
  if (st.dark === value) return
  st.dark = value
  applyThemeClass()
  saveUiPref()
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
  const mod = e.ctrlKey || e.metaKey
  // 命令菜单：Ctrl/⌘+Shift+P 或 F1
  if ((mod && e.shiftKey && e.key.toLowerCase() === 'p') || e.key === 'F1') {
    e.preventDefault()
    togglePalette()
    return
  }
  if (mod && e.key === ',') {
    e.preventDefault()
    toggleSettings()
    return
  }
  if (e.key === 'Escape') {
    if (st.settingsOpen) {
      e.preventDefault()
      closeSettings()
      return
    }
    if (st.dialog.open) {
      e.preventDefault()
      closeDialog()
      return
    }
    if (st.langMenuOpen) {
      e.preventDefault()
      closeLangMenu()
      return
    }
    if (st.paletteOpen) {
      e.preventDefault()
      closePalette()
      return
    }
    if (st.aboutOpen) {
      e.preventDefault()
      closeAbout()
      return
    }
    if (st.sidebarOpen) {
      e.preventDefault()
      closeSidebar()
      return
    }
  }
  if (mod && e.key.toLowerCase() === 's') {
    e.preventDefault()
    persistNow()
    showToast(t('toast.noManualSaveAt', { time: timeHM() }))
  }
}

/* ---------------- 代码着色（语言模式，每篇草稿独立） ---------------- */
/** 当前草稿的语言模式：Monaco 语言 id，或 `auto` 表示按内容自动检测 */
export function langOf(id: string | null | undefined): string {
  const meta = id ? st.index[id] : null
  const mode = meta?.lang || AUTO_LANG
  return mode === AUTO_LANG || isKnownLang(mode) ? mode : AUTO_LANG
}

/** 计算并记录「实际用于着色」的语言（自动检测模式下按正文推断） */
export function resolveLangFor(id: string | null | undefined, text: string): string {
  const mode = langOf(id)
  st.resolvedLang = mode === AUTO_LANG ? detectLang(text) : mode
  return st.resolvedLang
}

let langDetectTimer: number | undefined
/** 自动检测模式下正文变化：节流重算（只在结果真的变了才写回，避免反复清 token 缓存） */
function scheduleLangDetect(text: string): void {
  if (langOf(st.currentId) !== AUTO_LANG) return
  clearTimeout(langDetectTimer)
  langDetectTimer = window.setTimeout(() => {
    const next = detectLang(text)
    if (next !== st.resolvedLang) st.resolvedLang = next
  }, LANG_DETECT_DEBOUNCE)
}

/** 语言显示名：纯文本用界面语言文案（Monaco 的别名固定是英文 Plain Text） */
export function langName(id: string): string {
  return id === PLAINTEXT ? t('lang.plain') : langLabel(id)
}

/** 底栏显示用文案：自动检测模式下额外标注实际识别到的语言 */
export function langDisplayName(): string {
  const mode = currentLang.value
  if (mode === AUTO_LANG) return t('lang.autoWith', { lang: langName(st.resolvedLang) })
  return langName(mode)
}

/** 切换当前草稿的语言模式（只影响着色，不动正文） */
export function setCurrentLang(mode: string): void {
  const id = st.currentId
  if (!id) return
  const meta = st.index[id]
  const next = mode === AUTO_LANG || isKnownLang(mode) ? mode : AUTO_LANG
  if (meta && meta.lang !== next) {
    meta.lang = next
    commitIndex()
  }
  resolveLangFor(id, liveText())
  showToast(t('lang.set', { lang: next === AUTO_LANG ? langDisplayName() : langName(next) }))
}

export function openLangMenu(): void {
  st.langMenuOpen = true
}
export function closeLangMenu(): void {
  st.langMenuOpen = false
}
export function toggleLangMenu(): void {
  st.langMenuOpen = !st.langMenuOpen
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
  st.appearance.opacity = pref.bgOpacity
  st.appearance.blur = pref.bgBlur
  // 先用同步标记切好 has-bg（半透明表面 + 透明根背景），IndexedDB 里的图片随后异步补上
  st.appearance.hasImage = pref.hasBg
  st.appearance.editorTint = pref.editorTint
  syncBackgroundClass()
  void loadBackgroundImage()
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
