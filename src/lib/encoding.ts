/**
 * 文本编码支持。
 *
 * 编码只在「字节边界」上有意义：导出 .txt 时把字符串编码成字节，导入 .txt 时把字节解码成字符串；
 * 编辑器内部与 localStorage 里始终是 JS 字符串（UTF-16 代码单元），因此切换编码不会改动正文。
 *
 * - UTF-8 / UTF-8 BOM / UTF-16 LE|BE（含 BOM）：原生生成字节，无损。
 * - 传统单/双字节编码（GBK、Big5、Shift_JIS…）：**解码**直接用浏览器 TextDecoder；
 *   **编码**方向浏览器没有提供 API，因此这里用 fatal 模式的 TextDecoder 反向枚举
 *   所有合法字节序列，按需生成 char → bytes 映射表（首次使用某编码时构建并缓存）。
 */
export type EncodingId =
  | 'utf-8'
  | 'utf-8-bom'
  | 'utf-16le'
  | 'utf-16le-bom'
  | 'utf-16be'
  | 'utf-16be-bom'
  | 'gbk'
  | 'gb18030'
  | 'big5'
  | 'shift_jis'
  | 'euc-kr'
  | 'windows-1252'
  | 'iso-8859-1'

export interface EncodingDef {
  id: EncodingId
  label: string
  /** i18n key（enc.group.*），由 UI 层翻译 */
  groupKey: string
  kind: 'utf8' | 'utf16le' | 'utf16be' | 'legacy'
  bom: boolean
  /** 传统编码的 TextDecoder 标签（UTF 系列由本模块手工处理） */
  decoderLabel?: string
  /** 双字节前导字节范围，用于缩小反向枚举范围 */
  leadRanges?: [number, number][]
  /** i18n key（enc.hint.*） */
  hintKey?: string
}

export const ENCODINGS: EncodingDef[] = [
  { id: 'utf-8', label: 'UTF-8', groupKey: 'enc.group.unicode', kind: 'utf8', bom: false },
  { id: 'utf-8-bom', label: 'UTF-8 BOM', groupKey: 'enc.group.unicode', kind: 'utf8', bom: true },
  { id: 'utf-16le', label: 'UTF-16 LE', groupKey: 'enc.group.unicode', kind: 'utf16le', bom: false },
  { id: 'utf-16le-bom', label: 'UTF-16 LE BOM', groupKey: 'enc.group.unicode', kind: 'utf16le', bom: true },
  { id: 'utf-16be', label: 'UTF-16 BE', groupKey: 'enc.group.unicode', kind: 'utf16be', bom: false },
  { id: 'utf-16be-bom', label: 'UTF-16 BE BOM', groupKey: 'enc.group.unicode', kind: 'utf16be', bom: true },
  {
    id: 'gbk',
    label: 'GBK',
    groupKey: 'enc.group.chinese',
    kind: 'legacy',
    bom: false,
    decoderLabel: 'gbk',
    leadRanges: [[0x81, 0xfe]],
  },
  {
    id: 'gb18030',
    label: 'GB18030',
    groupKey: 'enc.group.chinese',
    kind: 'legacy',
    bom: false,
    decoderLabel: 'gb18030',
    leadRanges: [[0x81, 0xfe]],
    hintKey: 'enc.hint.gb18030',
  },
  {
    id: 'big5',
    label: 'Big5',
    groupKey: 'enc.group.chinese',
    kind: 'legacy',
    bom: false,
    decoderLabel: 'big5',
    leadRanges: [[0xa1, 0xf9]],
  },
  {
    id: 'shift_jis',
    label: 'Shift_JIS',
    groupKey: 'enc.group.japanese',
    kind: 'legacy',
    bom: false,
    decoderLabel: 'shift_jis',
    leadRanges: [
      [0x81, 0x9f],
      [0xe0, 0xfc],
    ],
  },
  {
    id: 'euc-kr',
    label: 'EUC-KR',
    groupKey: 'enc.group.korean',
    kind: 'legacy',
    bom: false,
    decoderLabel: 'euc-kr',
    leadRanges: [[0xa1, 0xfe]],
  },
  {
    id: 'windows-1252',
    label: 'Windows-1252',
    groupKey: 'enc.group.western',
    kind: 'legacy',
    bom: false,
    decoderLabel: 'windows-1252',
    leadRanges: [],
  },
  {
    id: 'iso-8859-1',
    label: 'ISO-8859-1',
    groupKey: 'enc.group.western',
    kind: 'legacy',
    bom: false,
    decoderLabel: 'iso-8859-1',
    leadRanges: [],
  },
]

export const DEFAULT_ENCODING: EncodingId = 'utf-8'
const UNMAPPABLE_BYTE = 0x3f // '?'

export function getEncodingDef(id: string | null | undefined): EncodingDef {
  return ENCODINGS.find((e) => e.id === id) ?? ENCODINGS[0]
}

export function encodingLabel(id: string | null | undefined): string {
  return getEncodingDef(id).label
}

export function groupedEncodings(): { groupKey: string; items: EncodingDef[] }[] {
  const groups = new Map<string, EncodingDef[]>()
  for (const e of ENCODINGS) {
    const list = groups.get(e.groupKey) ?? []
    list.push(e)
    groups.set(e.groupKey, list)
  }
  return [...groups.entries()].map(([groupKey, items]) => ({ groupKey, items }))
}

/** 浏览器是否支持解码该编码（不支持时 UI 置灰） */
export function isDecodable(id: string | null | undefined): boolean {
  const def = getEncodingDef(id)
  if (!def.decoderLabel) return true
  try {
    new TextDecoder(def.decoderLabel)
    return true
  } catch {
    return false
  }
}

/** 给下载 Blob 用的 charset 参数 */
export function mimeCharset(id: string | null | undefined): string {
  const def = getEncodingDef(id)
  if (def.kind === 'utf8') return 'utf-8'
  if (def.kind === 'utf16le') return 'utf-16le'
  if (def.kind === 'utf16be') return 'utf-16be'
  return def.decoderLabel ?? 'utf-8'
}

/* ---------------- BOM ---------------- */
const BOMS: { bytes: number[]; encoding: EncodingId }[] = [
  { bytes: [0xef, 0xbb, 0xbf], encoding: 'utf-8-bom' },
  { bytes: [0xff, 0xfe], encoding: 'utf-16le-bom' },
  { bytes: [0xfe, 0xff], encoding: 'utf-16be-bom' },
]

export function detectBom(bytes: Uint8Array): { encoding: EncodingId; length: number } | null {
  for (const b of BOMS) {
    if (bytes.length >= b.bytes.length && b.bytes.every((v, i) => bytes[i] === v)) {
      return { encoding: b.encoding, length: b.bytes.length }
    }
  }
  return null
}

/* ---------------- 反向映射表（legacy 编码 → 字节） ---------------- */
const reverseMaps = new Map<string, Map<string, number[]>>()

function buildReverseMap(def: EncodingDef): Map<string, number[]> {
  const cached = reverseMaps.get(def.id)
  if (cached) return cached
  const map = new Map<string, number[]>()
  let dec: TextDecoder | null = null
  try {
    dec = new TextDecoder(def.decoderLabel!, { fatal: true })
  } catch {
    reverseMaps.set(def.id, map)
    return map
  }

  // 单字节
  const one = new Uint8Array(1)
  for (let b = 0; b < 256; b++) {
    one[0] = b
    try {
      const s = dec.decode(one)
      if (s.length === 1 && s !== '\uFFFD' && !map.has(s)) map.set(s, [b])
    } catch {
      /* 非法单字节，跳过 */
    }
  }
  // 双字节
  const two = new Uint8Array(2)
  for (const [lo, hi] of def.leadRanges ?? []) {
    for (let a = lo; a <= hi; a++) {
      two[0] = a
      for (let b = 0; b < 256; b++) {
        two[1] = b
        try {
          const s = dec.decode(two)
          if (s.length === 1 && s !== '\uFFFD' && !map.has(s)) map.set(s, [a, b])
        } catch {
          /* 非法组合，跳过 */
        }
      }
    }
  }
  reverseMaps.set(def.id, map)
  return map
}

/* ---------------- 编码 ---------------- */
function encodeUtf16(text: string, littleEndian: boolean, bom: boolean): Uint8Array {
  const out = new Uint8Array(text.length * 2 + (bom ? 2 : 0))
  let o = 0
  if (bom) {
    out[o++] = littleEndian ? 0xff : 0xfe
    out[o++] = littleEndian ? 0xfe : 0xff
  }
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (littleEndian) {
      out[o++] = c & 0xff
      out[o++] = c >> 8
    } else {
      out[o++] = c >> 8
      out[o++] = c & 0xff
    }
  }
  return out
}

export interface EncodeResult {
  bytes: Uint8Array
  /** 该编码无法表示、已写成 ? 的字符数 */
  unmappable: number
}

export function encodeTextDetailed(text: string, id: string | null | undefined): EncodeResult {
  const def = getEncodingDef(id)
  if (def.kind === 'utf8') {
    const body = new TextEncoder().encode(text)
    if (!def.bom) return { bytes: body, unmappable: 0 }
    const out = new Uint8Array(body.length + 3)
    out.set([0xef, 0xbb, 0xbf], 0)
    out.set(body, 3)
    return { bytes: out, unmappable: 0 }
  }
  if (def.kind === 'utf16le' || def.kind === 'utf16be') {
    return { bytes: encodeUtf16(text, def.kind === 'utf16le', def.bom), unmappable: 0 }
  }
  const map = buildReverseMap(def)
  const bytes: number[] = []
  let unmappable = 0
  for (const ch of text) {
    const hit = map.get(ch)
    if (hit) {
      for (const b of hit) bytes.push(b)
    } else if (ch.charCodeAt(0) < 0x80) {
      bytes.push(ch.charCodeAt(0))
    } else {
      bytes.push(UNMAPPABLE_BYTE)
      unmappable++
    }
  }
  return { bytes: new Uint8Array(bytes), unmappable }
}

export function encodeText(text: string, id: string | null | undefined): Uint8Array {
  return encodeTextDetailed(text, id).bytes
}

/** 统计内容在该编码下无法表示的字符数（UTF 系列恒为 0） */
export function countUnmappable(text: string, id: string | null | undefined): number {
  const def = getEncodingDef(id)
  if (def.kind !== 'legacy') return 0
  const map = buildReverseMap(def)
  let n = 0
  for (const ch of text) {
    if (!map.has(ch) && ch.charCodeAt(0) >= 0x80) n++
  }
  return n
}

/* ---------------- 解码 ---------------- */
export interface DecodeResult {
  text: string
  encoding: EncodingId
  detectedBom: boolean
}

function decodeWithDef(bytes: Uint8Array, def: EncodingDef): string {
  if (def.kind === 'utf8') return new TextDecoder('utf-8').decode(bytes)
  if (def.kind === 'utf16le') return new TextDecoder('utf-16le').decode(bytes)
  if (def.kind === 'utf16be') return new TextDecoder('utf-16be').decode(bytes)
  return new TextDecoder(def.decoderLabel!).decode(bytes)
}

/** 解码字节：优先识别 BOM，否则用 fallback 编码（一般是当前草稿的编码设置） */
export function decodeBytes(bytes: Uint8Array, fallback: string | null | undefined): DecodeResult {
  const bom = detectBom(bytes)
  if (bom) {
    const def = getEncodingDef(bom.encoding)
    return { text: decodeWithDef(bytes.subarray(bom.length), def), encoding: def.id, detectedBom: true }
  }
  const def = getEncodingDef(fallback)
  return { text: decodeWithDef(bytes, def), encoding: def.id, detectedBom: false }
}
