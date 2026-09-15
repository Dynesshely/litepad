/**
 * 文本快捷操作的纯函数实现（不依赖编辑器与 store，便于单测与复用）。
 * 约定：所有行操作用「行块」模型处理，保留原文末尾是否带换行的语义。
 */

export interface LineBlock {
  lines: string[]
  trailingNewline: boolean
}

export function splitLineBlock(text: string): LineBlock {
  const trailingNewline = text.endsWith('\n')
  const body = trailingNewline ? text.slice(0, -1) : text
  return { lines: body.length ? body.split('\n') : [], trailingNewline }
}

export function joinLineBlock(block: LineBlock): string {
  if (!block.lines.length) return ''
  return block.lines.join('\n') + (block.trailingNewline ? '\n' : '')
}

export function mapLines(text: string, fn: (lines: string[]) => string[]): string {
  const block = splitLineBlock(text)
  return joinLineBlock({ lines: fn(block.lines), trailingNewline: block.trailingNewline })
}

/* ---------------- 行操作 ---------------- */

/** 多行 → 单行：按连接符拼接（会去掉行尾换行后再拼） */
export function joinLines(text: string, joiner: string): string {
  const block = splitLineBlock(text)
  return block.lines.join(joiner) + (block.trailingNewline && block.lines.length ? joiner : '')
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
  return joinLineBlock({ lines: out, trailingNewline: block.trailingNewline })
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
  return joinLineBlock({ lines: out, trailingNewline: block.trailingNewline })
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
  return Array.from(text).reverse().join('')
}

export interface TextStats {
  chars: number
  charsNoSpaces: number
  words: number
  lines: number
  bytes: number
}

export function textStats(text: string): TextStats {
  return {
    chars: Array.from(text).length,
    charsNoSpaces: Array.from(text.replace(/\s/g, '')).length,
    words: (text.match(/\S+/g) ?? []).length,
    lines: text.length ? text.split('\n').length : 0,
    bytes: new TextEncoder().encode(text).length,
  }
}
