/**
 * 轻量 i18n：无需第三方依赖。
 * - `locale` 是 Vue ref，模板里调用 `t()` 会自动随语言切换重渲染；
 * - 插值用 `{name}` 占位；
 * - 语言偏好的持久化由 store 统一写入 UI_KEY（本模块只负责运行时状态）；
 * - 新增语言只需往 LOCALES 与 messages 里加一项。
 */
import { ref } from 'vue'

export type LocaleId = 'zh-CN' | 'en-US'

export interface LocaleDef {
  id: LocaleId
  /** 菜单里的完整名称 */
  label: string
  /** 按钮上的短标签 */
  short: string
}

export const LOCALES: LocaleDef[] = [
  { id: 'zh-CN', label: '简体中文', short: '中' },
  { id: 'en-US', label: 'English', short: 'EN' },
]

export const FALLBACK_LOCALE: LocaleId = 'zh-CN'

const messages: Record<LocaleId, Record<string, string>> = {
  'zh-CN': {
    'app.title': 'Litepad',
    'app.titleAuto': 'Litepad · 自动保存',
    'app.docTitle': '{title} — Litepad',
    'doc.untitled': '未命名',

    'tb.new': '＋ 新建',
    'tb.newTitle': '新开一篇独立草稿（也可以直接新开浏览器标签）',
    'tb.docs': '📄 草稿列表',
    'tb.docsPinned': '📄 草稿列表 · 已固定',
    'tb.docsTitle': '查看 / 管理所有草稿（可在面板里固定到左侧常驻）',
    'tb.docsPinnedTitle': '取消固定：草稿列表回到浮层抽屉',
    'tb.history': '🕘 历史快照',
    'tb.historyTitle': '当前草稿的历史快照，可恢复到几分钟前',
    'tb.undo': '↩ 回退一步',
    'tb.undoTitle': '把内容换回上一次自动保存的版本（再点一次可换回）',
    'tb.export': '⬇ 导出 .txt',
    'tb.exportTitle': '把当前草稿按当前编码另存为 .txt 文件',
    'tb.backup': '💾 备份全部',
    'tb.backupTitle': '把全部草稿（含编码设置）打包成 JSON 备份文件',
    'tb.import': '📂 导入备份',
    'tb.importTitle': '从 JSON 备份文件合并导入草稿',
    'tb.themeToDark': '切换到深色模式',
    'tb.themeToLight': '切换到浅色模式',
    'tb.lang': '切换界面语言',
    'tb.logoTitle': '临时草稿本',

    'st.ready': '就绪',
    'st.saving': '自动保存中…',
    'st.saved': '已自动保存 {time}',
    'st.restored': '已从本地恢复',
    'st.emptyDraft': '空白草稿',
    'st.recovered': '已恢复',
    'st.undone': '已回退，可再点一次换回',
    'st.chars': '{chars} 字符 · {lines} 行',
    'st.quota': '本页源占用 {size}',
    'st.quotaFull': '本页源占用 {size} ⚠ 接近 5MB 上限，建议导出备份并清理',

    'list.title': '我的草稿',
    'list.new': '＋ 新建',
    'list.newAria': '新建草稿',
    'list.pin': '📌 固定',
    'list.pinned': '📌 已固定',
    'list.pinAria': '固定草稿列表到左侧',
    'list.unpinAria': '取消固定草稿列表',
    'list.pinTitle': '固定到左侧，作为全高常驻面板',
    'list.unpinTitle': '取消固定，回到浮层抽屉',
    'list.closeTitle': '关闭列表',
    'list.empty': '还没有草稿。直接输入即可自动创建。',
    'list.deleteTitle': '删除这篇草稿',
    'list.dragTitle': '按住可拖动调整顺序',
    'list.sortRecent': '⇅ 最近更新',
    'list.sortRecentTitle': '按最近更新时间重新排序',
    'list.moved': '已保存新的草稿顺序',
    'list.reordered': '已按最近更新重排',
    'list.footerDocked': '已固定常驻；新开浏览器标签打开本应用即为另一篇独立草稿。',
    'list.footerOverlay': '提示：新开浏览器标签打开本应用就是另一篇独立草稿；点「📌 固定」可常驻左侧。',

    'hist.title': '🕘 历史快照',
    'hist.close': '✕ 关闭',
    'hist.hint':
      '输入过程中每隔约 20 秒自动留一份快照（最多 40 份）。点击时间即可把编辑区恢复到该版本；当前内容会自动转入「回退一步」的重做位。',
    'hist.chars': '{n} 字符',
    'hist.restore': '恢复',
    'hist.empty': '暂无快照 —— 输入内容后会自动开始记录。',

    'enc.current': '当前草稿的文本编码',
    'enc.import': '📥 按当前编码导入 .txt 文件…',
    'enc.note':
      '编码只作用于「导出 / 导入 .txt」的字节解读，编辑器内部始终按字符处理，切换编码不会改动正文。文件自带 BOM 时自动识别；绿色勾为当前草稿所用编码。',
    'enc.group.unicode': 'Unicode',
    'enc.group.chinese': '中文',
    'enc.group.japanese': '日文',
    'enc.group.korean': '韩文',
    'enc.group.western': '西欧',
    'enc.hint.gb18030': '四字节生僻字不支持编码',
    'enc.unsupported': '当前浏览器不支持 {enc}',
    'enc.set': '当前草稿编码已设为 {enc}',
    'enc.setWarn': '编码已设为 {enc}：当前内容有 {n} 个字符无法表示，导出时会写成 ?',
    'enc.exported': '已按 {enc} 导出 {name}（{size} 字节）',
    'enc.exportedWarn': '；{n} 个字符无法用 {enc} 表示，已写成 ?',
    'enc.exportEmpty': '当前草稿为空，没有可导出的内容',
    'enc.importConfirm':
      '按 {enc} 解读「{file}」（{size} 字节）并替换当前草稿内容？\n当前内容可用「↩ 回退一步」找回。',
    'enc.imported': '已按 {enc} 导入 {file}{bom}，共 {chars} 字符',
    'enc.importedBom': '（检测到 BOM）',
    'enc.importFailed': '导入失败：无法读取该文件',

    'toast.newDraft': '已新建一篇空白草稿',
    'toast.deleted': '已删除「{title}」',
    'toast.deletedAndNew': '已删除「{title}」，并新开一篇空白草稿',
    'confirm.delete': '删除草稿「{title}」？\n正文、历史快照将一并删除，无法恢复（除非导出过备份）。',
    'toast.noOlder': '暂无更早的版本可回退',
    'toast.rolledBack': '已回退到上一次自动保存的版本（可再点一次换回）',
    'toast.snapshotRestored': '已恢复到 {time} 的版本',
    'toast.noDrafts': '还没有任何草稿',
    'toast.backedUp': '已备份 {n} 篇草稿',
    'toast.importSummary': '导入完成：新增 {added} 篇，更新 {updated} 篇，跳过 {skipped} 篇',
    'toast.importBadFormat': '导入失败：文件格式不正确',
    'toast.noManualSave': '无需手动保存：内容已自动保存',
    'toast.noManualSaveAt': '无需手动保存：已自动保存于 {time}',
    'toast.pinned': '草稿列表已固定到左侧（再点工具栏按钮可取消固定）',
    'toast.historyNoDraft': '还没有草稿',

    'banner.dismiss': '关闭提示',
    'banner.noStorage':
      '⚠ 此浏览器当前不允许持久化存储（localStorage 不可用，常见于部分隐私模式或受限环境）。内容仍会自动保存，但只在本页会话内有效，关闭页面即丢失。请尽快「备份全部」到本地文件。',    'banner.fileHint':
      '已开启自动保存。首次使用请自测：输入几行文字 → 按 F5 刷新 → 内容应原样保留。若刷新后变空，说明该浏览器在 file:// 打开方式下不持久化 localStorage，请改用本地 http 服务打开（如 npm run dev / npm run preview）。',
    'banner.degraded':
      '⚠ localStorage 不可用或已写满，内容目前只暂存在浏览器会话中（关闭窗口会丢失）。请「备份全部」导出，或到草稿列表删除旧草稿释放空间。',

    'monaco.placeholder':
      '在这里开始输入……\n\n内容会自动保存到本浏览器的 localStorage：无需 Ctrl+S、无需任何手动保存，直接关闭标签页、刷新都不丢。\n\n· Ctrl+S 已被拦截（你不需要保存文件）\n· 想再开一篇临时稿：点「＋ 新建」或新开一个浏览器标签打开本页\n· 担心手滑删光？「🕘 历史快照」和「↩ 回退一步」可以救回来',

    'time.justNow': '刚刚',
    'time.minutesAgo': '{n} 分钟前',
    'time.hoursAgo': '{n} 小时前',

    'about.open': '关于 Litepad',
    'about.version': '版本 {version}',
    'about.build': '构建 {build}',
    'about.row.version': '版本',
    'about.row.build': '构建',
    'about.row.editor': '编辑器内核',
    'about.row.editor.value': 'Monaco Editor（VS Code 同款）',
    'about.row.framework': '框架',
    'about.row.framework.value': 'Vue 3 · Vite 8 · Tailwind CSS v4',
    'about.row.storage': '数据存储',
    'about.row.storage.value': '本机浏览器 localStorage（无后端）',
    'about.row.usage': '本页占用',
    'about.row.drafts': '草稿数量',
    'about.row.drafts.value': '{n} 篇',
    'about.row.current': '当前草稿',
    'about.row.current.value': '{title} · {chars} 字符',
    'about.row.language': '界面语言',
    'about.row.theme': '主题',
    'about.theme.dark': '深色',
    'about.theme.light': '浅色',
    'about.row.snapshot': '快照策略',
    'about.row.snapshot.value': '每 20 秒一份 · 每篇最多 40 份',
    'about.row.encoding': '默认编码',
    'about.footer': '数据不离开你的浏览器',
    'about.copy': '复制诊断信息',
    'about.copied': '诊断信息已复制',
    'about.copyFailed': '复制失败，请手动选择文本',
    'about.close': '关闭',
  },

  'en-US': {
    'app.title': 'Litepad',
    'app.titleAuto': 'Litepad · Autosave',
    'app.docTitle': '{title} — Litepad',
    'doc.untitled': 'Untitled',

    'tb.new': '＋ New',
    'tb.newTitle': 'Create another independent draft (or just open this app in a new tab)',
    'tb.docs': '📄 Drafts',
    'tb.docsPinned': '📄 Drafts · Pinned',
    'tb.docsTitle': 'Browse / manage all drafts (pin the list to the left to keep it visible)',
    'tb.docsPinnedTitle': 'Unpin: put the draft list back into a drawer',
    'tb.history': '🕘 History',
    'tb.historyTitle': 'Snapshots of this draft — restore a version from minutes ago',
    'tb.undo': '↩ Undo step',
    'tb.undoTitle': 'Swap back to the previously autosaved version (click again to swap back)',
    'tb.export': '⬇ Export .txt',
    'tb.exportTitle': 'Save this draft as a .txt file using its encoding',
    'tb.backup': '💾 Back up all',
    'tb.backupTitle': 'Export every draft (including encodings) as a JSON backup',
    'tb.import': '📂 Import backup',
    'tb.importTitle': 'Merge drafts from a JSON backup file',
    'tb.themeToDark': 'Switch to dark mode',
    'tb.themeToLight': 'Switch to light mode',
    'tb.lang': 'Change interface language',
    'tb.logoTitle': 'Scratchpad',

    'st.ready': 'Ready',
    'st.saving': 'Autosaving…',
    'st.saved': 'Autosaved {time}',
    'st.restored': 'Restored from this browser',
    'st.emptyDraft': 'Blank draft',
    'st.recovered': 'Restored',
    'st.undone': 'Rolled back — click again to redo',
    'st.chars': '{chars} chars · {lines} lines',
    'st.quota': 'This origin: {size}',
    'st.quotaFull': 'This origin: {size} ⚠ near the 5 MB limit — export a backup and clean up',

    'list.title': 'My drafts',
    'list.new': '＋ New',
    'list.newAria': 'New draft',
    'list.pin': '📌 Pin',
    'list.pinned': '📌 Pinned',
    'list.pinAria': 'Pin the draft list to the left',
    'list.unpinAria': 'Unpin the draft list',
    'list.pinTitle': 'Pin to the left as a full-height panel',
    'list.unpinTitle': 'Unpin and go back to the drawer',
    'list.closeTitle': 'Close list',
    'list.empty': 'No drafts yet — just start typing and one is created automatically.',
    'list.deleteTitle': 'Delete this draft',
    'list.dragTitle': 'Drag to reorder',
    'list.sortRecent': '⇅ Recent',
    'list.sortRecentTitle': 'Reorder by last modified time',
    'list.moved': 'New draft order saved',
    'list.reordered': 'Reordered by last modified',
    'list.footerDocked': 'Pinned. Open this app in another browser tab for another independent draft.',
    'list.footerOverlay':
      'Tip: a new browser tab gives you another independent draft; click “📌 Pin” to keep this list docked.',

    'hist.title': '🕘 History',
    'hist.close': '✕ Close',
    'hist.hint':
      'A snapshot is taken about every 20 seconds while typing (up to 40). Click a time to restore the editor to that version; the current content moves into the “Undo step” redo slot.',
    'hist.chars': '{n} chars',
    'hist.restore': 'Restore',
    'hist.empty': 'No snapshots yet — recording starts as soon as you type.',

    'enc.current': 'Text encoding of this draft',
    'enc.import': '📥 Import a .txt using this encoding…',
    'enc.note':
      'Encoding affects only the bytes when exporting / importing .txt; the editor always works with characters, so switching encoding never changes the text. A leading BOM is detected automatically; the green check marks the current encoding.',
    'enc.group.unicode': 'Unicode',
    'enc.group.chinese': 'Chinese',
    'enc.group.japanese': 'Japanese',
    'enc.group.korean': 'Korean',
    'enc.group.western': 'Western',
    'enc.hint.gb18030': '4-byte rare chars unsupported',
    'enc.unsupported': 'This browser does not support {enc}',
    'enc.set': 'Draft encoding set to {enc}',
    'enc.setWarn': 'Encoding set to {enc}: {n} characters cannot be represented and will be written as ?',
    'enc.exported': 'Exported {name} as {enc} ({size} bytes)',
    'enc.exportedWarn': '; {n} characters cannot be represented in {enc} and were written as ?',
    'enc.exportEmpty': 'This draft is empty — nothing to export',
    'enc.importConfirm':
      'Interpret “{file}” as {enc} ({size} bytes) and replace the current draft?\nThe current content can be recovered with “↩ Undo step”.',
    'enc.imported': 'Imported {file} as {enc}{bom} — {chars} characters',
    'enc.importedBom': ' (BOM detected)',
    'enc.importFailed': 'Import failed: cannot read this file',

    'toast.newDraft': 'New blank draft created',
    'toast.deleted': 'Deleted “{title}”',
    'toast.deletedAndNew': 'Deleted “{title}” and opened a new blank draft',
    'confirm.delete':
      'Delete draft “{title}”?\nIts content and snapshots will be removed and cannot be recovered (unless you exported a backup).',
    'toast.noOlder': 'No earlier version to roll back to',
    'toast.rolledBack': 'Rolled back to the last autosaved version (click again to swap back)',
    'toast.snapshotRestored': 'Restored the {time} version',
    'toast.noDrafts': 'No drafts yet',
    'toast.backedUp': 'Backed up {n} drafts',
    'toast.importSummary': 'Import complete — added {added}, updated {updated}, skipped {skipped}',
    'toast.importBadFormat': 'Import failed: unsupported file format',
    'toast.noManualSave': 'No need to save — content is autosaved',
    'toast.noManualSaveAt': 'No need to save — autosaved at {time}',
    'toast.pinned': 'Draft list pinned to the left (click the toolbar button again to unpin)',
    'toast.historyNoDraft': 'No drafts yet',

    'banner.dismiss': 'Dismiss',
    'banner.noStorage':
      '⚠ This browser does not allow persistent storage (localStorage is unavailable — common in some private-mode or restricted environments). Content is still autosaved, but only for this page session: closing the page loses it. Please “💾 Back up all” to a local file soon.',
    'banner.fileHint':
      'Autosave is on. Please self-test once: type a few lines → press F5 → the content should still be there. If it disappears, this browser does not persist localStorage for file:// pages — serve the app over http instead (e.g. npm run dev / npm run preview).',
    'banner.degraded':
      '⚠ localStorage is unavailable or full, so content is only kept for this browser session (lost when the window closes). Use “💾 Back up all”, or delete old drafts to free space.',

    'monaco.placeholder':
      'Start typing…\n\nEverything is autosaved to this browser’s localStorage: no Ctrl+S, no save dialogs — closing the tab or reloading is safe.\n\n· Ctrl+S is intercepted (you never need to save a file)\n· Need another scratch draft? Click “＋ New” or open this app in a new tab\n· Deleted something by accident? “🕘 History” and “↩ Undo step” can bring it back',

    'time.justNow': 'just now',
    'time.minutesAgo': '{n} min ago',
    'time.hoursAgo': '{n} h ago',

    'about.open': 'About Litepad',
    'about.version': 'Version {version}',
    'about.build': 'Build {build}',
    'about.row.version': 'Version',
    'about.row.build': 'Build',
    'about.row.editor': 'Editor core',
    'about.row.editor.value': 'Monaco Editor (the same core as VS Code)',
    'about.row.framework': 'Framework',
    'about.row.framework.value': 'Vue 3 · Vite 8 · Tailwind CSS v4',
    'about.row.storage': 'Storage',
    'about.row.storage.value': 'This browser’s localStorage (no backend)',
    'about.row.usage': 'Origin usage',
    'about.row.drafts': 'Drafts',
    'about.row.drafts.value': '{n}',
    'about.row.current': 'Current draft',
    'about.row.current.value': '{title} · {chars} chars',
    'about.row.language': 'Language',
    'about.row.theme': 'Theme',
    'about.theme.dark': 'Dark',
    'about.theme.light': 'Light',
    'about.row.snapshot': 'Snapshots',
    'about.row.snapshot.value': 'one every 20 s · up to 40 per draft',
    'about.row.encoding': 'Default encoding',
    'about.footer': 'Your data never leaves this browser',
    'about.copy': 'Copy diagnostics',
    'about.copied': 'Diagnostics copied',
    'about.copyFailed': 'Copy failed — select the text manually',
    'about.close': 'Close',
  },
}

export const locale = ref<LocaleId>(FALLBACK_LOCALE)

/** 从浏览器语言猜测初始语言 */
export function detectLocale(): LocaleId {
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : ''
  return nav.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}

export function isLocaleId(id: unknown): id is LocaleId {
  return typeof id === 'string' && LOCALES.some((l) => l.id === id)
}

export function setLocale(id: string): void {
  locale.value = isLocaleId(id) ? id : FALLBACK_LOCALE
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale.value
  }
}

export function localeLabel(id: string = locale.value): string {
  return LOCALES.find((l) => l.id === id)?.label ?? id
}

export function localeShort(id: string = locale.value): string {
  return LOCALES.find((l) => l.id === id)?.short ?? id
}

/**
 * 取翻译文本。`t()` 在组件模板中调用会依赖 `locale` ref，
 * 因此切换语言时使用到它的组件会自动重渲染。
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = messages[locale.value] ?? messages[FALLBACK_LOCALE]
  let text = dict[key]
  if (text === undefined) {
    text = messages[FALLBACK_LOCALE][key]
    if (text === undefined) {
      if (import.meta.env.DEV) console.warn(`[i18n] missing key: ${key}`)
      return key
    }
  }
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value))
    }
  }
  return text
}
