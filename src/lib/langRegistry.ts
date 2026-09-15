/**
 * 语言名称注册表：把 Monaco 注册的语言 id 映射成可读名称。
 *
 * 单独成模块的原因：`languages.ts` 只放与编辑器无关的纯逻辑（自动检测 / 常用清单），
 * 这里才需要依赖 monaco。菜单与底栏都从这里取名字，保证「同一个 id 到哪儿都叫同一个名」。
 */
import * as monaco from 'monaco-editor'
import { COMMON_LANGS } from './languages'

export interface LangEntry {
  id: string
  label: string
}

let cache: LangEntry[] | null = null

/** Monaco 已注册的全部语言（按名称排序；别名取第一个作为显示名） */
export function allLanguages(): LangEntry[] {
  if (cache) return cache
  try {
    cache = monaco.languages
      .getLanguages()
      .map((l) => ({
        id: l.id,
        label: (Array.isArray(l.aliases) && l.aliases[0]) || l.id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  } catch {
    cache = []
  }
  return cache
}

/** 常用语言（顺序按 COMMON_LANGS，且只保留 Monaco 里真实存在的） */
export function commonLanguages(): LangEntry[] {
  const all = new Map(allLanguages().map((l) => [l.id, l]))
  const out: LangEntry[] = []
  for (const id of COMMON_LANGS) {
    const hit = all.get(id)
    if (hit) {
      out.push(hit)
      all.delete(id)
    }
  }
  return out
}

/** 除常用之外的全部语言（含 Monaco 的自定义注册项） */
export function otherLanguages(): LangEntry[] {
  const common = new Set(commonLanguages().map((l) => l.id))
  return allLanguages().filter((l) => !common.has(l.id))
}

/** 语言 id → 显示名（未知 id 原样返回，便于排查） */
export function langLabel(id: string): string {
  if (!id) return ''
  const hit = allLanguages().find((l) => l.id === id)
  return hit ? hit.label : id
}

/** 兜底：Monaco 里没有这个 id 时（例如老数据里的自定义语言）回退到纯文本 */
export function isKnownLang(id: string): boolean {
  return allLanguages().some((l) => l.id === id)
}
