<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as monaco from 'monaco-editor'
// 注意：monaco-editor 0.56 的 package exports 会把 `./*` 映射到 `./esm/vs/*.js`，
// 因此 worker 入口应写作 editor/editor.worker（不要再带 esm/vs 前缀）
import editorWorker from 'monaco-editor/editor/editor.worker?worker'
import {
  st,
  bindEditorSink,
  contentOf,
  isSuppressingEvents,
  onEditorReady,
  onUserInput,
  openPalette,
  persistNow,
  showToast,
} from '../store'
import { locale, t } from '../lib/i18n'

const host = ref<HTMLDivElement | null>(null)

let editor: monaco.editor.IStandaloneCodeEditor | null = null
let model: monaco.editor.ITextModel | null = null
let contentDisposable: monaco.IDisposable | null = null
let cursorDisposable: monaco.IDisposable | null = null
let cmdDisposable: monaco.IDisposable | null = null
let paletteDisposable: monaco.IDisposable | null = null

let workerReady = false
function ensureWorker(): void {
  if (workerReady) return
  workerReady = true
  window.MonacoEnvironment = {
    // 纯文本场景只需要 editor worker；其余 label 同样回退到它，避免告警
    getWorker: () => new editorWorker(),
  }
}

onMounted(() => {
  ensureWorker()
  const id = st.currentId
  const initial = contentOf(id)

  model = monaco.editor.createModel(initial, 'plaintext')
  editor = monaco.editor.create(host.value!, {
    model,
    theme: st.dark ? 'vs-dark' : 'vs',
    automaticLayout: true,
    fontFamily: "'SFMono-Regular', Consolas, 'JetBrains Mono', Menlo, monospace",
    fontSize: 14,
    lineHeight: 22,
    minimap: { enabled: false },
    wordWrap: 'on',
    scrollBeyondLastLine: false,
    tabSize: 2,
    insertSpaces: true,
    detectIndentation: false,
    padding: { top: 14, bottom: 14 },
    renderLineHighlight: 'all',
    scrollbar: {
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
      alwaysConsumeMouseWheel: false,
    },
    placeholder: t('monaco.placeholder'),
  })

  bindEditorSink({
    getText: () => model?.getValue() ?? '',
    setText: (text) => {
      model?.setValue(text)
    },
    getTarget: () => {
      const m = model!
      const ed = editor!
      const sel = ed.getSelection() ?? new monaco.Selection(1, 1, 1, 1)
      const hasSelection = !sel.isEmpty()
      const lineStart = m.getOffsetAt(new monaco.Position(sel.startLineNumber, 1))
      const lineEnd = m.getOffsetAt(
        new monaco.Position(sel.endLineNumber, m.getLineMaxColumn(sel.endLineNumber)),
      )
      return {
        full: m.getValue(),
        selected: hasSelection ? m.getValueInRange(sel) : '',
        hasSelection,
        selectionStart: m.getOffsetAt(sel.getStartPosition()),
        selectionEnd: m.getOffsetAt(sel.getEndPosition()),
        lineText: m.getValueInRange(
          new monaco.Range(sel.startLineNumber, 1, sel.endLineNumber, m.getLineMaxColumn(sel.endLineNumber)),
        ),
        lineStart,
        lineEnd,
      }
    },
    replaceRange: (start, end, text) => {
      const m = model!
      const ed = editor!
      const from = m.getPositionAt(start)
      const to = m.getPositionAt(end)
      // 走 executeEdits：命令式替换是「一步」，可被一次 Ctrl+Z 撤销
      ed.executeEdits('litepad-command', [
        {
          range: new monaco.Range(from.lineNumber, from.column, to.lineNumber, to.column),
          text,
          forceMoveMarkers: true,
        },
      ])
      const after = m.getPositionAt(start + text.length)
      ed.setSelection(
        new monaco.Range(from.lineNumber, from.column, after.lineNumber, after.column),
      )
      ed.focus()
    },
    selectRange: (start, end) => {
      const m = model!
      const ed = editor!
      const from = m.getPositionAt(start)
      const to = m.getPositionAt(end)
      ed.setSelection(new monaco.Range(from.lineNumber, from.column, to.lineNumber, to.column))
      ed.focus()
    },
    goToLine: (line) => {
      const ed = editor!
      const total = model?.getLineCount() ?? 1
      const target = Math.min(Math.max(1, line), total)
      ed.revealLineInCenter(target)
      ed.setPosition({ lineNumber: target, column: 1 })
      ed.focus()
    },
    focus: () => editor?.focus(),
  })

  contentDisposable = model.onDidChangeContent(() => {
    if (isSuppressingEvents()) return
    onUserInput(model?.getValue() ?? '')
  })

  // 测试钩子：把当前光标所在行号写到 <html data-cursor-line>，便于端到端断言导航类命令
  cursorDisposable = editor.onDidChangeCursorPosition((e) => {
    document.documentElement.dataset.cursorLine = String(e.position.lineNumber)
  })

  cmdDisposable = editor.addAction({
    id: 'scratch.autosave.flush',
    label: t('toast.noManualSave'),
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
    contextMenuGroupId: 'navigation',
    run: () => {
      persistNow()
      showToast(t('toast.noManualSave'))
    },
  })

  paletteDisposable = editor.addAction({
    id: 'litepad.command-palette',
    label: t('cmd.openHint'),
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP,
      monaco.KeyCode.F1,
    ],
    contextMenuGroupId: 'navigation',
    run: () => openPalette(),
  })

  onEditorReady()
})

watch(
  () => st.dark,
  (dark) => monaco.editor.setTheme(dark ? 'vs-dark' : 'vs'),
)

// 切换语言时同步占位符文案
watch(locale, () => {
  editor?.updateOptions({ placeholder: t('monaco.placeholder') })
})

onBeforeUnmount(() => {
  bindEditorSink(null)
  paletteDisposable?.dispose()
  cmdDisposable?.dispose()
  cursorDisposable?.dispose()
  contentDisposable?.dispose()
  editor?.dispose()
  editor = null
  model?.dispose()
  model = null
})
</script>

<template>
  <div class="h-full w-full min-h-0 overflow-hidden bg-white dark:bg-zinc-950">
    <div ref="host" class="h-full w-full"></div>
  </div>
</template>
