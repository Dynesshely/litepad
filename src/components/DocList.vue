<script setup lang="ts">
import { closeSidebar, createNewDoc, deleteDoc, docs, pinSidebar, st, switchToDoc, unpinSidebar } from '../store'
import { fmtRel } from '../lib/format'
import { encodingLabel } from '../lib/encoding'

const props = defineProps<{ mode: 'docked' | 'overlay' }>()

function onNew(): void {
  createNewDoc()
  if (props.mode === 'overlay') closeSidebar()
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div
      class="flex items-center justify-between border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-800"
    >
      <span class="text-sm font-semibold text-zinc-800 dark:text-zinc-100">我的草稿</span>
      <span class="flex items-center gap-1">
        <button class="btn" title="新开一篇草稿" @click="onNew()">＋ 新建</button>
        <button
          v-if="mode === 'overlay'"
          data-testid="pin-btn"
          class="btn"
          title="固定到左侧，作为全高常驻面板"
          @click="pinSidebar()"
        >
          📌 固定
        </button>
        <button
          v-else
          data-testid="unpin-btn"
          class="btn border-indigo-400 text-indigo-600 dark:border-indigo-400 dark:text-indigo-300"
          title="取消固定，回到浮层抽屉"
          @click="unpinSidebar()"
        >
          📌 已固定
        </button>
        <button v-if="mode === 'overlay'" class="btn btn-icon" title="关闭列表" @click="closeSidebar()">
          ✕
        </button>
      </span>
    </div>

    <ul class="flex-1 overflow-y-auto p-1.5">
      <li v-if="!docs.length" class="px-3 py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
        还没有草稿。直接输入即可自动创建。
      </li>

      <li
        v-for="d in docs"
        :key="d.id"
        class="group mb-0.5 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        :class="d.id === st.currentId ? 'bg-zinc-100 dark:bg-zinc-800' : ''"
        @click="switchToDoc(d.id)"
      >
        <span
          class="h-5 w-0.5 shrink-0 rounded-full transition-colors"
          :class="d.id === st.currentId ? 'bg-indigo-500' : 'bg-transparent'"
        ></span>
        <span class="min-w-0 flex-1">
          <span
            class="block truncate text-xs font-medium text-zinc-700 dark:text-zinc-200"
            :class="d.id === st.currentId ? 'text-indigo-600 dark:text-indigo-300' : ''"
          >
            {{ d.title }}
          </span>
          <span class="block text-[10px] text-zinc-400 dark:text-zinc-500">
            <span class="font-mono">{{ encodingLabel(d.encoding) }}</span>
            · {{ fmtRel(d.updatedAt) }}
          </span>
        </span>
        <button
          class="shrink-0 rounded px-1 py-0.5 text-xs opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/60 dark:hover:text-red-400"
          title="删除这篇草稿"
          @click.stop="deleteDoc(d.id)"
        >
          🗑
        </button>
      </li>
    </ul>

    <div
      class="border-t border-zinc-200 px-3 py-1.5 text-[10px] leading-4 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500"
    >
      <template v-if="mode === 'docked'">已固定常驻；新开浏览器标签打开本应用即为另一篇独立草稿。</template>
      <template v-else>提示：新开浏览器标签打开本应用就是另一篇独立草稿；点「📌 固定」可常驻左侧。</template>
    </div>
  </div>
</template>
