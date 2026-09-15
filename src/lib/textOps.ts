/**
 * 文本快捷操作的纯函数实现（不依赖编辑器与 store，便于单测与复用）。
 * 约定：所有行操作用「行块」模型处理，保留原文末尾是否带换行的语义。
 */

export interface LineBlock {
  lines: string[]
  trailingNewline: boolean
  /** 原文使用的主换行符（CRLF 文本在编辑时可能残留 \r，这里统一归一化后再处理） */
  eol: '\n' | '\r\n'
}

/**
 * 把文本切成行块。
 * 关键：先归一化 CRLF / 孤立 CR，否则从 Windows 粘贴来的文本会在每行尾部残留 `\r`，
 * 导致「多行转单行」后仍出现断行（`\r` 被编辑器当作换行渲染）。
 */
export function splitLineBlock(text: string): LineBlock {
  const eol: '\n' | '\r\n' = text.includes('\r\n') ? '\r\n' : '\n'
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const trailingNewline = normalized.endsWith('\n')
  const body = trailingNewline ? normalized.slice(0, -1) : normalized
  return { lines: body.length ? body.split('\n') : [], trailingNewline, eol }
}

export function joinLineBlock(block: LineBlock): string {
  if (!block.lines.length) return ''
  return block.lines.join(block.eol) + (block.trailingNewline ? block.eol : '')
}

export function mapLines(text: string, fn: (lines: string[]) => string[]): string {
  const block = splitLineBlock(text)
  return joinLineBlock({ lines: fn(block.lines), trailingNewline: block.trailingNewline, eol: block.eol })
}

/** 归一化换行符（CRLF / CR → LF），供统计等只读逻辑使用 */
export function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/* ---------------- 行操作 ---------------- */

/** 多行 → 单行：按连接符拼接（会去掉行尾换行后再拼） */
export function joinLines(text: string, joiner: string): string {
  const block = splitLineBlock(text)
  if (!block.lines.length) return ''
  const joined = block.lines.join(joiner)
  return block.trailingNewline ? joined + joiner : joined
}

/** 把用户输入的 `\n` / `\t` 字面量还原为真实字符 */
export function unescapeJoiner(input: string): string {
  return input.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r')
}

/** 单行 → 多行：按分隔符拆分后每段一行 */
export function splitToLines(text: string, separator: string): string {
  if (!separator) return text
  const block = splitLineBlock(text)
  const out = block.lines.flatMap((line) => line.split(separator))
  return joinLineBlock({ lines: out, trailingNewline: block.trailingNewline, eol: block.eol })
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export function sortLines(text: string, direction: 'asc' | 'desc' = 'asc'): string {
  return mapLines(text, (lines) => {
    const sorted = [...lines].sort((a, b) => collator.compare(a, b))
    return direction === 'desc' ? sorted.reverse() : sorted
  })
}

/** 行去重（保留首次出现的顺序） */
export function dedupeLines(text: string): string {
  return mapLines(text, (lines) => {
    const seen = new Set<string>()
    return lines.filter((line) => (seen.has(line) ? false : (seen.add(line), true)))
  })
}

export function reverseLines(text: string): string {
  return mapLines(text, (lines) => [...lines].reverse())
}

export function removeEmptyLines(text: string): string {
  return mapLines(text, (lines) => lines.filter((line) => line.trim().length > 0))
}

export function trimLines(text: string): string {
  return mapLines(text, (lines) => lines.map((line) => line.trim()))
}

export function trimTrailingWhitespace(text: string): string {
  return mapLines(text, (lines) => lines.map((line) => line.replace(/[ \t]+$/, '')))
}

export function numberLines(text: string, format = '{n}. '): string {
  let i = 0
  return mapLines(text, (lines) =>
    lines.map((line) => (line.length === 0 ? line : format.replace('{n}', String(++i)) + line)),
  )
}

export function quoteLines(text: string, quote = '"'): string {
  return mapLines(text, (lines) =>
    lines.map((line) => quote + line.split(quote).join('\\' + quote) + quote),
  )
}

/** 行注释切换：全部都带前缀则去掉，否则统一加上 */
export function toggleCommentLines(text: string, prefix = '// '): string {
  const block = splitLineBlock(text)
  const target = block.lines.filter((line) => line.trim().length > 0)
  const allCommented = target.length > 0 && target.every((line) => line.startsWith(prefix))
  const out = block.lines.map((line) => {
    if (!line.length) return line
    return allCommented ? line.slice(prefix.length) : prefix + line
  })
  return joinLineBlock({ lines: out, trailingNewline: block.trailingNewline, eol: block.eol })
}

export function markdownQuote(text: string): string {
  return mapLines(text, (lines) => lines.map((line) => '> ' + line))
}

/* ---------------- 大小写与命名 ---------------- */

export function toUpperCaseText(text: string): string {
  return text.toUpperCase()
}
export function toLowerCaseText(text: string): string {
  return text.toLowerCase()
}
export function toggleCaseText(text: string): string {
  return text.replace(/[a-zA-Z]/g, (ch) =>
    ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase(),
  )
}

/** 拆词：按非字母数字边界 + 驼峰边界 */
export function splitWords(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
}

export function toKebabCase(text: string): string {
  return splitWords(text).map((w) => w.toLowerCase()).join('-')
}
export function toSnakeCase(text: string): string {
  return splitWords(text).map((w) => w.toLowerCase()).join('_')
}
export function toCamelCase(text: string): string {
  const words = splitWords(text).map((w) => w.toLowerCase())
  if (!words.length) return ''
  return words[0] + words.slice(1).map((w) => w[0].toUpperCase() + w.slice(1)).join('')
}

/* ---------------- 编码与数据 ---------------- */

export function base64Encode(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function base64Decode(text: string): string {
  const binary = atob(text.trim())
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}

export function urlEncode(text: string): string {
  return encodeURIComponent(text)
}
export function urlDecode(text: string): string {
  return decodeURIComponent(text)
}

export function jsonFormat(text: string): string {
  return JSON.stringify(JSON.parse(text), null, 2)
}
export function jsonMinify(text: string): string {
  return JSON.stringify(JSON.parse(text))
}
/** 把文本转义成 JSON 字符串字面量（含外层引号） */
export function jsonEscape(text: string): string {
  return JSON.stringify(text)
}
/** 反转义 JSON 字符串字面量；若不是字符串字面量则原样返回 */
export function jsonUnescape(text: string): string {
  const trimmed = text.trim()
  if (!(trimmed.startsWith('"') && trimmed.endsWith('"'))) return text
  const parsed: unknown = JSON.parse(trimmed)
  return typeof parsed === 'string' ? parsed : text
}

/* ---------------- 其它 ---------------- */

export function reverseChars(text: string): string {
  const reversed = Array.from(text).reverse().join('')
  // 反转会把 CRLF 拆成 LF CR，这里修复回来，保持原文档的换行风格
  return reversed.replace(/\n\r/g, '\r\n')
}

export interface TextStats {
  chars: number
  charsNoSpaces: number
  words: number
  lines: number
  bytes: number
}

export function textStats(text: string): TextStats {
  // 字符/词/行按归一化后的文本统计（换行符不该被算作「字符」），字节数按原始文本（真实体积）
  const normalized = normalizeEol(text)
  return {
    chars: Array.from(normalized).length,
    charsNoSpaces: Array.from(normalized.replace(/\s/g, '')).length,
    words: (normalized.match(/\S+/g) ?? []).length,
    lines: normalized.length ? normalized.split('\n').length : 0,
    bytes: new TextEncoder().encode(text).length,
  }
}
