<script setup lang="ts">
import { ref } from 'vue'
import { encodingLabel, groupedEncodings, isDecodable } from '../lib/encoding'
import { importTextFile, showToast } from '../store'

defineProps<{ current: string }>()
const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'close'): void
}>()

const groups = groupedEncodings()
const fileInput = ref<HTMLInputElement | null>(null)

function pick(id: string): void {
  if (!isDecodable(id)) {
    showToast(`当前浏览器不支持 ${encodingLabel(id)}`)
    return
  }
  emit('select', id)
  emit('close')
}

function onFile(e: Event): void {
  const input = e.target as HTMLInputElement
  if (input.files && input.files[0]) {
    importTextFile(input.files[0])
    emit('close')
  }
  input.value = ''
}
</script>

<template>
  <!-- 点击菜单外任意处关闭 -->
  <div class="fixed inset-0 z-40" @click="emit('close')"></div>

  <div
    class="absolute right-0 bottom-full z-50 mb-1.5 max-h-[62vh] w-80 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
  >
    <div class="px-2 py-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
      当前草稿的文本编码
    </div>

    <template v-for="g in groups" :key="g.group">
      <div class="px-2 pt-1.5 pb-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">{{ g.group }}</div>
      <button
        v-for="e in g.items"
        :key="e.id"
        :data-enc="e.id"
        class="flex w-full cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-800"
        :disabled="!isDecodable(e.id)"
        @click="pick(e.id)"
      >
        <span
          class="font-mono"
          :class="e.id === current ? 'font-semibold text-indigo-600 dark:text-indigo-300' : 'text-zinc-700 dark:text-zinc-200'"
        >
          {{ e.label }}
        </span>
        <span class="flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
          <span v-if="e.hint">{{ e.hint }}</span>
          <span v-if="e.id === current" class="text-indigo-500">✓</span>
        </span>
      </button>
    </template>

    <div class="my-1 border-t border-zinc-200 dark:border-zinc-700"></div>

    <button
      data-testid="enc-import"
      class="w-full cursor-pointer rounded px-2 py-1 text-left text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
      @click="fileInput?.click()"
    >
      📥 按当前编码导入 .txt 文件…
    </button>
    <input
      ref="fileInput"
      data-testid="enc-file-input"
      type="file"
      accept=".txt,text/plain"
      class="hidden"
      @change="onFile"
    />

    <p class="px-2 pt-1 pb-0.5 text-[10px] leading-4 text-zinc-400 dark:text-zinc-500">
      编码只作用于「导出 / 导入 .txt」的字节解读，编辑器内部始终按字符处理，切换编码不会改动正文。
      文件自带 BOM 时自动识别；绿色勾为当前草稿所用编码。
    </p>
  </div>
</template>
