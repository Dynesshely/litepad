export function downloadBlob(name: string, blob: Blob): void {
  const a = document.createElement('a')
  const url = URL.createObjectURL(blob)
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(url)
    a.remove()
  }, 800)
}

export function downloadText(name: string, text: string, mime = 'text/plain;charset=utf-8'): void {
  downloadBlob(name, new Blob([text], { type: mime }))
}

/** 下载任意字节（用于按指定编码导出 .txt） */
export function downloadBytes(name: string, bytes: Uint8Array, mime = 'application/octet-stream'): void {
  // 复制到独立的 ArrayBuffer，避免 SharedArrayBuffer 视图不被 BlobPart 接受
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  downloadBlob(name, new Blob([copy.buffer], { type: mime }))
}
