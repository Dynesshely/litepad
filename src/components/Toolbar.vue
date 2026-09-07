<script setup lang="ts">
import { ref } from 'vue'
import {
  st,
  backupAll,
  createNewDoc,
  exportCurrentTxt,
  importBackupFile,
  openHistory,
  toggleDark,
  toggleSidebar,
  undoOneStep,
} from '../store'

const fileInput = ref<HTMLInputElement | null>(null)

function onFile(e: Event): void {
  const input = e.target as HTMLInputElement
  if (input.files && input.files[0]) importBackupFile(input.files[0])
  input.value = ''
}
</script>

<template>
  <header
    class="flex flex-wrap items-center gap-1.5 border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
  >
    <div class="mr-2 flex select-none items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
      <span class="grid h-6 w-6 place-items-center rounded-md bg-indigo-500 text-xs text-white shadow-sm">✎</span>
      临时草稿本
    </div>

    <button class="btn" title="新开一篇独立草稿（也可以直接新开浏览器标签）" @click="createNewDoc()">＋ 新建</button>
    <button class="btn" title="查看 / 管理所有草稿" @click="toggleSidebar()">📄 草稿列表</button>
    <button class="btn" :disabled="!st.currentId" title="当前草稿的历史快照，可恢复到几分钟前" @click="openHistory()">
      🕘 历史快照
    </button>
    <button class="btn" :disabled="!st.currentId" title="把内容换回上一次自动保存的版本（再点一次可换回）" @click="undoOneStep()">
      ↩ 回退一步
    </button>

    <span class="mx-1 hidden h-4 w-px bg-zinc-200 sm:block dark:bg-zinc-700"></span>

    <button class="btn" :disabled="!st.currentId" title="把当前草稿另存为 .txt 文件" @click="exportCurrentTxt()">
      ⬇ 导出 .txt
    </button>
    <button class="btn" title="把全部草稿打包成 JSON 备份文件" @click="backupAll()">💾 备份全部</button>
    <button class="btn" title="从 JSON 备份文件合并导入草稿" @click="fileInput?.click()">📂 导入备份</button>
    <input ref="fileInput" type="file" accept=".json,application/json" class="hidden" @change="onFile" />

    <div class="flex-1"></div>

    <button class="btn" :title="st.dark ? '切换到浅色模式' : '切换到深色模式'" @click="toggleDark()">
      {{ st.dark ? '☀️' : '🌙' }}
    </button>
  </header>
</template>
