import { t } from './i18n'
import { normalizeEol } from './textOps'

export const pad2 = (n: number): string => (n < 10 ? '0' + n : String(n))

export function fmtFull(ts: number): string {
  const d = new Date(ts)
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  )
}

export function timeHM(ts: number = Date.now()): string {
  return fmtFull(ts).slice(11)
}

export function fmtStamp(ts: number): string {
  return fmtFull(ts).replace(/[-: ]/g, '').slice(0, 14)
}

export function fmtRel(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60e3) return t('time.justNow')
  if (diff < 3600e3) return t('time.minutesAgo', { n: Math.floor(diff / 60e3) })
  if (diff < 86400e3) return t('time.hoursAgo', { n: Math.floor(diff / 3600e3) })
  return fmtFull(ts).slice(0, 16)
}

/** 标题 = 首个非空行（截断到 40 字） */
export function titleOf(text: string): string {
  const lines = normalizeEol(String(text)).split('\n')
  for (const raw of lines) {
    const line = raw.trim()
    if (line) return line.length > 40 ? line.slice(0, 40) + '…' : line
  }
  return t('doc.untitled')
}

/** 把标题转成安全的文件名片段 */
export function safeName(s: string): string {
  return String(s).replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40) || 'untitled'
}
