/**
 * 存储层：localStorage → sessionStorage → 内存，逐级降级。
 * 键契约与 v1 原型 (legacy/scratch.html) 完全一致，换新工程后旧草稿可直接继承。
 */
export const NS = 'dsh.scratch.v1'
export const INDEX_KEY = `${NS}.index`
export const UI_KEY = `${NS}.ui`
export const HINT_KEY = `${NS}.fileHintShown`
export const docKey = (id: string) => `${NS}.doc.${id}`
export const bakKey = (id: string) => `${NS}.doc.${id}.bak`
export const histKey = (id: string) => `${NS}.doc.${id}.hist`

const mem = new Map<string, string>()
let storeOk = false

/** 探测 localStorage 是否可用（隐私模式 / 禁用存储时不可用） */
export function detectStore(): boolean {
  try {
    localStorage.setItem(NS + '.probe', '1')
    localStorage.removeItem(NS + '.probe')
    storeOk = true
  } catch {
    storeOk = false
  }
  return storeOk
}

export function isStoreOk(): boolean {
  return storeOk
}

export type WriteTarget = 'ls' | 'sess' | 'mem'

export function rawGet(key: string): string | null {
  if (storeOk) {
    try {
      const v = localStorage.getItem(key)
      if (v !== null) return v
    } catch {
      /* 忽略并继续降级 */
    }
  }
  try {
    const s = sessionStorage.getItem(key)
    if (s !== null) return s
  } catch {
    /* 忽略 */
  }
  return mem.get(key) ?? null
}

export function rawSet(key: string, value: string): WriteTarget {
  if (storeOk) {
    try {
      localStorage.setItem(key, value)
      return 'ls'
    } catch {
      /* 配额写满 / 安全异常 → 降级 */
    }
  }
  try {
    sessionStorage.setItem(key, value)
    return 'sess'
  } catch {
    /* 忽略 */
  }
  mem.set(key, value)
  return 'mem'
}

export function rawDel(key: string): void {
  if (storeOk) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* 忽略 */
    }
  }
  try {
    sessionStorage.removeItem(key)
  } catch {
    /* 忽略 */
  }
  mem.delete(key)
}
