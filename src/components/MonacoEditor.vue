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
  persistNow,
  showToast,
} from '../store'
import { locale, t } from '../lib/i18n'

const host = ref<HTMLDivElement | null>(null)

let editor: monaco.editor.IStandaloneCodeEditor | null = null
let model: monaco.editor.ITextModel | null = null
let contentDisposable: monaco.IDisposable | null = null
let cmdDisposable: monaco.IDisposable | null = null

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
    setText: (text) => model?.setValue(text),
  })

  contentDisposable = model.onDidChangeContent(() => {
    if (isSuppressingEvents()) return
    onUserInput(model?.getValue() ?? '')
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
  cmdDisposable?.dispose()
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
