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
