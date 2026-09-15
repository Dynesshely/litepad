/**
 * 命令菜单的命令注册表。
 *
 * - 命令只描述「做什么」：作用范围（选区 / 覆盖选区所在整行 / 全文）+ 纯函数变换；
 *   与编辑器交互（读取选区、单步撤销的替换、跳转）由 store 通过 CommandContext 注入，
 *   因此本文件不依赖 store，避免循环依赖。
 * - 标题、分组、提示均为 i18n key，由 UI 层翻译。
 */
import { t } from './i18n'
import * as ops from './textOps'

export type CommandKind = 'transform' | 'info' | 'action'
/**
 * 作用范围：
 * - `auto`  ：有选区就作用于选区，否则全文
 * - `lines` ：有选区就作用于**选区覆盖的整行**；无选区则作用于**整篇**
 *             （对齐 VSCode：行排序/去重/删除空行等在无选区时处理整个文档，
 *              否则只处理光标所在的一行会表现为「点了没反应」）
 * - `whole` ：始终全文
 */
export type CommandScope = 'auto' | 'lines' | 'whole'

/** 编辑器当前状态快照（由 store 注入） */
export interface TextTarget {
  full: string
  selected: string
  hasSelection: boolean
  /** 选区在全文中的偏移（无选区时两者相等，即光标位置） */
  selectionStart: number
  selectionEnd: number
  /** 选区（或光标）覆盖的整行文本 */
  lineText: string
  lineStart: number
  lineEnd: number
}

export interface CommandPromptDef {
  titleKey: string
  labelKey: string
  placeholderKey?: string
  defaultValue?: string
}

interface CommandBase {
  id: string
  groupKey: string
  titleKey: string
  /** 额外的搜索关键词（英文缩写、中文别名等） */
  keywords?: string[]
}

export interface TransformCommand extends CommandBase {
  kind: 'transform'
  scope: CommandScope
  /** 需要参数：弹框输入 */
  prompt?: CommandPromptDef
  /** 参数取自当前选区；选区为空时回退到 prompt */
  argFromSelection?: boolean
  transform: (text: string, arg: string) => string
}

export interface InfoCommand extends CommandBase {
  kind: 'info'
  run: (target: TextTarget) => { titleKey: string; rows: { label: string; value: string }[] }
}

export interface ActionCommand extends CommandBase {
  kind: 'action'
  prompt?: CommandPromptDef
  /** 动作类命令：不直接改文本，由 store 注入编辑器动作（如跳转） */
  run: (ctx: {
    target: TextTarget
    value: string
    goToLine: (line: number) => void
    openSettings: () => void
    /** 打开底栏的代码语言（着色）选择菜单 */
    openLangMenu: () => void
  }) => void
}

export type CommandDef = TransformCommand | InfoCommand | ActionCommand

const G_LINES = 'cmd.group.lines'
const G_CASE = 'cmd.group.case'
const G_DATA = 'cmd.group.data'
const G_TEXT = 'cmd.group.text'
const G_NAV = 'cmd.group.nav'

const joinerPrompt: CommandPromptDef = {
  titleKey: 'cmd.prompt.joiner.title',
  labelKey: 'cmd.prompt.joiner.label',
  placeholderKey: 'cmd.prompt.joiner.placeholder',
  defaultValue: ', ',
}
const splitterPrompt: CommandPromptDef = {
  titleKey: 'cmd.prompt.splitter.title',
  labelKey: 'cmd.prompt.splitter.label',
  placeholderKey: 'cmd.prompt.splitter.placeholder',
}

export const COMMANDS: CommandDef[] = [
  /* ---------------- 行操作 ---------------- */
  {
    kind: 'transform',
    id: 'lines.join',
    groupKey: G_LINES,
    titleKey: 'cmd.lines.join',
    keywords: ['join', 'oneline', '合并', '连接'],
    scope: 'auto',
    prompt: joinerPrompt,
    transform: (text, arg) => ops.joinLines(text, ops.unescapeJoiner(arg ?? '')),
  },
  {
    kind: 'transform',
    id: 'lines.split',
    groupKey: G_LINES,
    titleKey: 'cmd.lines.split',
    keywords: ['split', 'multiline', '拆分', '分隔'],
    scope: 'lines',
    argFromSelection: true,
    prompt: splitterPrompt,
    transform: (text, arg) => ops.splitToLines(text, arg),
  },
  {
    kind: 'transform',
    id: 'lines.splitAll',
    groupKey: G_LINES,
    titleKey: 'cmd.lines.splitAll',
    keywords: ['split all', '整篇拆分'],
    scope: 'whole',
    prompt: splitterPrompt,
    transform: (text, arg) => ops.splitToLines(text, arg),
  },
  {
    kind: 'transform',
    id: 'lines.sortAsc',
    groupKey: G_LINES,
    titleKey: 'cmd.lines.sortAsc',
    keywords: ['sort', 'asc', '排序'],
    scope: 'lines',
    transform: (text) => ops.sortLines(text, 'asc'),
  },
  {
    kind: 'transform',
    id: 'lines.sortDesc',
    groupKey: G_LINES,
    titleKey: 'cmd.lines.sortDesc',
    keywords: ['sort', 'desc', '倒序'],
    scope: 'lines',
    transform: (text) => ops.sortLines(text, 'desc'),
  },
  {
    kind: 'transform',
    id: 'lines.dedupe',
    groupKey: G_LINES,
    titleKey: 'cmd.lines.dedupe',
    keywords: ['unique', 'dedupe', '去重'],
    scope: 'lines',
    transform: (text) => ops.dedupeLines(text),
  },
  {
    kind: 'transform',
    id: 'lines.reverse',
    groupKey: G_LINES,
    titleKey: 'cmd.lines.reverse',
    keywords: ['reverse', '反转'],
    scope: 'lines',
    transform: (text) => ops.reverseLines(text),
  },
  {
    kind: 'transform',
    id: 'lines.removeEmpty',
    groupKey: G_LINES,
    titleKey: 'cmd.lines.removeEmpty',
    keywords: ['empty', 'blank', '空行'],
    scope: 'lines',
    transform: (text) => ops.removeEmptyLines(text),
  },
  {
    kind: 'transform',
    id: 'lines.trim',
    groupKey: G_LINES,
    titleKey: 'cmd.lines.trim',
    keywords: ['trim', '空白'],
    scope: 'lines',
    transform: (text) => ops.trimLines(text),
  },
  {
    kind: 'transform',
    id: 'lines.trimTrailing',
    groupKey: G_LINES,
    titleKey: 'cmd.lines.trimTrailing',
    keywords: ['trailing', '行尾空白'],
    scope: 'lines',
    transform: (text) => ops.trimTrailingWhitespace(text),
  },
  {
    kind: 'transform',
    id: 'lines.number',
    groupKey: G_LINES,
    titleKey: 'cmd.lines.number',
    keywords: ['number', '行号'],
    scope: 'lines',
    transform: (text) => ops.numberLines(text),
  },
  {
    kind: 'transform',
    id: 'lines.quote',
    groupKey: G_LINES,
    titleKey: 'cmd.lines.quote',
    keywords: ['quote', '引号'],
    scope: 'lines',
    transform: (text) => ops.quoteLines(text),
  },
  {
    kind: 'transform',
    id: 'lines.comment',
    groupKey: G_LINES,
    titleKey: 'cmd.lines.comment',
    keywords: ['comment', '注释'],
    scope: 'lines',
    transform: (text) => ops.toggleCommentLines(text),
  },

  /* ---------------- 大小写与命名 ---------------- */
  {
    kind: 'transform',
    id: 'case.upper',
    groupKey: G_CASE,
    titleKey: 'cmd.case.upper',
    keywords: ['uppercase', '大写'],
    scope: 'auto',
    transform: (text) => ops.toUpperCaseText(text),
  },
  {
    kind: 'transform',
    id: 'case.lower',
    groupKey: G_CASE,
    titleKey: 'cmd.case.lower',
    keywords: ['lowercase', '小写'],
    scope: 'auto',
    transform: (text) => ops.toLowerCaseText(text),
  },
  {
    kind: 'transform',
    id: 'case.toggle',
    groupKey: G_CASE,
    titleKey: 'cmd.case.toggle',
    keywords: ['toggle case', '互换'],
    scope: 'auto',
    transform: (text) => ops.toggleCaseText(text),
  },
  {
    kind: 'transform',
    id: 'case.kebab',
    groupKey: G_CASE,
    titleKey: 'cmd.case.kebab',
    keywords: ['kebab', 'dash'],
    scope: 'auto',
    transform: (text) => ops.toKebabCase(text),
  },
  {
    kind: 'transform',
    id: 'case.snake',
    groupKey: G_CASE,
    titleKey: 'cmd.case.snake',
    keywords: ['snake', 'underscore'],
    scope: 'auto',
    transform: (text) => ops.toSnakeCase(text),
  },
  {
    kind: 'transform',
    id: 'case.camel',
    groupKey: G_CASE,
    titleKey: 'cmd.case.camel',
    keywords: ['camel'],
    scope: 'auto',
    transform: (text) => ops.toCamelCase(text),
  },

  /* ---------------- 编码与数据 ---------------- */
  {
    kind: 'transform',
    id: 'base64.encode',
    groupKey: G_DATA,
    titleKey: 'cmd.base64.encode',
    keywords: ['base64', 'encode'],
    scope: 'auto',
    transform: (text) => ops.base64Encode(text),
  },
  {
    kind: 'transform',
    id: 'base64.decode',
    groupKey: G_DATA,
    titleKey: 'cmd.base64.decode',
    keywords: ['base64', 'decode'],
    scope: 'auto',
    transform: (text) => ops.base64Decode(text),
  },
  {
    kind: 'transform',
    id: 'url.encode',
    groupKey: G_DATA,
    titleKey: 'cmd.url.encode',
    keywords: ['url', 'percent', 'encode'],
    scope: 'auto',
    transform: (text) => ops.urlEncode(text),
  },
  {
    kind: 'transform',
    id: 'url.decode',
    groupKey: G_DATA,
    titleKey: 'cmd.url.decode',
    keywords: ['url', 'decode'],
    scope: 'auto',
    transform: (text) => ops.urlDecode(text),
  },
  {
    kind: 'transform',
    id: 'json.format',
    groupKey: G_DATA,
    titleKey: 'cmd.json.format',
    keywords: ['json', 'pretty', '美化', '格式化'],
    scope: 'auto',
    transform: (text) => ops.jsonFormat(text),
  },
  {
    kind: 'transform',
    id: 'json.minify',
    groupKey: G_DATA,
    titleKey: 'cmd.json.minify',
    keywords: ['json', 'minify', '压缩'],
    scope: 'auto',
    transform: (text) => ops.jsonMinify(text),
  },
  {
    kind: 'transform',
    id: 'json.escape',
    groupKey: G_DATA,
    titleKey: 'cmd.json.escape',
    keywords: ['json', 'escape', '转义'],
    scope: 'auto',
    transform: (text) => ops.jsonEscape(text),
  },
  {
    kind: 'transform',
    id: 'json.unescape',
    groupKey: G_DATA,
    titleKey: 'cmd.json.unescape',
    keywords: ['json', 'unescape', '反转义'],
    scope: 'auto',
    transform: (text) => ops.jsonUnescape(text),
  },

  /* ---------------- 文本 ---------------- */
  {
    kind: 'transform',
    id: 'text.reverseChars',
    groupKey: G_TEXT,
    titleKey: 'cmd.text.reverseChars',
    keywords: ['reverse', '反转字符'],
    scope: 'auto',
    transform: (text) => ops.reverseChars(text),
  },
  {
    kind: 'transform',
    id: 'text.markdownQuote',
    groupKey: G_TEXT,
    titleKey: 'cmd.text.markdownQuote',
    keywords: ['markdown', 'quote', '引用'],
    scope: 'lines',
    transform: (text) => ops.markdownQuote(text),
  },
  {
    kind: 'transform',
    id: 'text.collapseSpaces',
    groupKey: G_TEXT,
    titleKey: 'cmd.text.collapseSpaces',
    keywords: ['spaces', '空白折叠'],
    scope: 'auto',
    transform: (text) => text.replace(/[ \t]+/g, ' '),
  },

  /* ---------------- 导航与信息 ---------------- */
  {
    kind: 'info',
    id: 'text.stats',
    groupKey: G_NAV,
    titleKey: 'cmd.text.stats',
    keywords: ['stats', 'count', '统计', '字数'],
    run: (target) => {
      const scope = target.hasSelection ? target.selected : target.full
      const stats = ops.textStats(scope)
      return {
        titleKey: target.hasSelection ? 'cmd.stats.titleSelection' : 'cmd.stats.titleAll',
        rows: [
          { label: t('cmd.stats.chars'), value: String(stats.chars) },
          { label: t('cmd.stats.charsNoSpaces'), value: String(stats.charsNoSpaces) },
          { label: t('cmd.stats.words'), value: String(stats.words) },
          { label: t('cmd.stats.lines'), value: String(stats.lines) },
          { label: t('cmd.stats.bytes'), value: String(stats.bytes) },
        ],
      }
    },
  },
  {
    kind: 'action',
    id: 'nav.langMode',
    groupKey: G_NAV,
    titleKey: 'cmd.nav.langMode',
    keywords: ['language', 'syntax', 'highlight', 'coloring', 'json', '语言', '着色', '高亮', '语法'],
    run: ({ openLangMenu }) => openLangMenu(),
  },
  {
    kind: 'action',
    id: 'nav.openSettings',
    groupKey: G_NAV,
    titleKey: 'cmd.nav.openSettings',
    keywords: ['settings', 'preferences', 'config', '设置', '偏好'],
    run: ({ openSettings }) => openSettings(),
  },
  {
    kind: 'action',
    id: 'nav.goToLine',
    groupKey: G_NAV,
    titleKey: 'cmd.nav.goToLine',
    keywords: ['goto', 'line', '跳转'],
    prompt: {
      titleKey: 'cmd.nav.goToLine',
      labelKey: 'cmd.prompt.lineNo.label',
      placeholderKey: 'cmd.prompt.lineNo.placeholder',
      defaultValue: '1',
    },
    run: ({ value, goToLine }) => {
      const n = Number.parseInt(value, 10)
      if (Number.isFinite(n) && n >= 1) goToLine(n)
    },
  },
]

export function findCommand(id: string): CommandDef | undefined {
  return COMMANDS.find((c) => c.id === id)
}

export function commandTitle(def: CommandDef): string {
  return t(def.titleKey)
}

/**
 * 简易模糊匹配：返回 -1 表示不匹配；分数越高越靠前。
 * 命中完整子串、词首或前缀会获得额外加权。
 */
export function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase()
  const s = text.toLowerCase()
  if (!q) return 1
  const direct = s.indexOf(q)
  if (direct === 0) return 1000
  if (direct > 0) return 700 - direct
  // 子序列匹配
  let score = 0
  let idx = 0
  let streak = 0
  for (const ch of q) {
    const found = s.indexOf(ch, idx)
    if (found === -1) return -1
    streak = found === idx ? streak + 1 : 0
    score += 10 + streak * 5 - Math.min(found - idx, 10)
    idx = found + 1
  }
  return Math.max(score, 1)
}

/** 供命令菜单搜索用：把命令的可搜索文本拼在一起 */
export function searchHaystack(def: CommandDef): string {
  return [t(def.titleKey), def.id, ...(def.keywords ?? [])].join(' ')
}
