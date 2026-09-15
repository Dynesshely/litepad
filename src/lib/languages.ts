/**
 * 代码着色用到的语言清单与「自动检测」。
 *
 * - 语言 id 沿用 Monaco 的 id（`json` / `typescript` / `plaintext` …），
 *   菜单在运行时用 `monaco.languages.getLanguages()` 取全集，这里只负责
 *   「常用优先排序」与「自动检测」这类与编辑器无关的纯逻辑，因此不引入 monaco。
 * - 草稿可以选「自动检测」（`auto`），此时按正文内容猜一个语言；猜不出来就是纯文本。
 */

/** 「自动检测」的哨兵值（不是 Monaco 的语言 id） */
export const AUTO_LANG = 'auto'
export const PLAINTEXT = 'plaintext'

/** 常用语言：菜单里排在前面，且不带「全部」分组标签 */
export const COMMON_LANGS: string[] = [
  PLAINTEXT,
  'json',
  'javascript',
  'typescript',
  'html',
  'css',
  'markdown',
  'python',
  'shell',
  'yaml',
  'xml',
  'sql',
  'ini',
  'dockerfile',
  'c',
  'cpp',
  'csharp',
  'java',
  'go',
  'rust',
  'php',
  'ruby',
  'kotlin',
  'swift',
  'lua',
  'perl',
  'r',
  'powershell',
  'bat',
  'scss',
  'less',
  'graphql',
  'diff',
]

/** 自动检测时最多看前多少字符（大文件不必全文扫描） */
const SCAN_LIMIT = 20000

/**
 * 按正文内容猜语言。策略是**宁可不猜**：只在信号足够明确时返回具体语言，
 * 否则返回 plaintext —— 猜错着色反而比不着色更让人困惑。
 */
export function detectLang(text: string): string {
  const raw = text.slice(0, SCAN_LIMIT)
  const s = raw.trim()
  if (!s) return PLAINTEXT

  // ---- 结构化数据 ----
  if (/^[[{]/.test(s) && /[}\]]$/.test(s)) {
    try {
      JSON.parse(s)
      return 'json'
    } catch {
      /* 不是合法 JSON，继续判断 */
    }
  }
  if (/^<\?xml\b/i.test(s)) return 'xml'
  if (/^<!doctype\s+html/i.test(s) || /<html[\s>]/i.test(s)) return 'html'
  if (/^<\?php\b/i.test(s)) return 'php'

  // ---- shebang ----
  const firstLine = s.split('\n', 1)[0]
  if (firstLine.startsWith('#!')) {
    if (/python/.test(firstLine)) return 'python'
    if (/node|deno|bun/.test(firstLine)) return 'javascript'
    return 'shell'
  }

  // ---- Dockerfile ----
  if (/^[ \t]*FROM\s+\S+/im.test(s) && /^[ \t]*(RUN|CMD|COPY|ENTRYPOINT|WORKDIR|EXPOSE)\s/im.test(s)) {
    return 'dockerfile'
  }

  // ---- YAML ----
  const lines = s.split('\n')
  const kvLines = lines.filter((l) => /^\s*(-\s+)?[\w.$-]+:\s*(\S.*)?$/.test(l)).length
  if (lines[0].trim() === '---' && kvLines >= 2 && !/[{};]/.test(s)) return 'yaml'
  if (kvLines >= 3 && kvLines / lines.length >= 0.6 && !/[{};]/.test(s)) return 'yaml'

  // ---- 编程语言（先用特征关键词，再看通用花括号语言）----
  if (
    /^[ \t]*(select|insert\s+into|update|delete\s+from|create\s+table)\b/im.test(s) &&
    /\b(from|where|values|set|join|group\s+by)\b/i.test(s)
  ) {
    return 'sql'
  }
  if (/^[ \t]*(package\s+main\b|func\s+\w+\s*\()/m.test(s)) return 'go'
  if (/^[ \t]*(fn\s+\w+\s*[(<]|use\s+std::|impl\s+\w+|pub\s+(fn|struct)\b)/m.test(s)) return 'rust'
  if (/\bpublic\s+(static\s+)?(class|void|interface|final\s+class)\b/.test(s)) return 'java'
  if (/^[ \t]*#include\s*[<"]/m.test(s)) {
    return /\bstd::|#include\s*<(iostream|vector|string|map|algorithm)>/.test(s) ? 'cpp' : 'c'
  }
  if (/^[ \t]*using\s+System\b|^[ \t]*namespace\s+[\w.]+\s*\{/m.test(s)) return 'csharp'
  if (
    /^[ \t]*(def\s+\w+\s*\([^)]*\)\s*:|class\s+[\w.]+\s*(\([^)]*\))?\s*:)/m.test(s) &&
    !/[{};]/.test(s)
  ) {
    return 'python'
  }
  if (/^[ \t]*(import\s+[\w.]+|from\s+[\w.]+\s+import\s)/m.test(s) && /:\s*$/m.test(s)) return 'python'
  if (
    /\binterface\s+\w+\s*\{|\btype\s+\w+\s*=|\benum\s+\w+\s*\{/.test(s) ||
    /\bfunction\s+\w+\s*\([^)]*\)\s*:\s*\w/.test(s) ||
    /\b(const|let)\s+\w+\s*:\s*(string|number|boolean|\w+\[\])\b/.test(s) ||
    /\b(public|private|readonly)\s+\w+\s*[:(]/.test(s)
  ) {
    return 'typescript'
  }
  if (/^[ \t]*(import|export)\b.*\bfrom\b|=>|\b(const|let|var|function|class)\b/.test(s) && /[{};]/.test(s)) {
    return 'javascript'
  }
  if (/^[ \t]*<\?php|^\s*\$\w+\s*=/.test(s)) return 'php'
  if (/^[ \t]*def\s+\w+.*$/m.test(s) && (/^[ \t]*end\s*$/m.test(s) || /\bputs\b|\battr_accessor\b/.test(s))) {
    return 'ruby'
  }

  // ---- Markdown（需要两个信号，避免把带 # 注释的代码当成 md）----
  const mdSignals = [
    /^#{1,6}\s+\S/m,
    /^[ \t]*[-*+]\s+\S/m,
    /^[ \t]*\d+\.\s+\S/m,
    /^```/m,
    /\[[^\]]+\]\([^)\s]+\)/,
    /^>\s+\S/m,
  ].filter((r) => r.test(s)).length
  if (mdSignals >= 2) return 'markdown'

  // ---- CSS ----
  if (
    /^[.#]?[\w-]+[^{}]*\{[^{}]*:[^{}]*;?[^{}]*\}/m.test(s) &&
    !/[<>]/.test(s) &&
    !/\bfunction\b/.test(s)
  ) {
    return 'css'
  }

  return PLAINTEXT
}
