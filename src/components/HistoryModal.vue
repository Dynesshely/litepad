<script setup lang="ts">
import { st, closeHistory, historyList, restoreSnapshot } from '../store'
import { fmtFull } from '../lib/format'

const rows = historyList
</script>

<template>
  <Transition name="fade">
    <div
      v-if="st.historyOpen"
      class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-[1px]"
      @click.self="closeHistory()"
    >
      <div
        class="flex max-h-[78vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <header
          class="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800"
        >
          <span class="text-sm font-semibold text-zinc-800 dark:text-zinc-100">🕘 历史快照</span>
          <button class="btn" @click="closeHistory()">✕ 关闭</button>
        </header>

        <p class="border-b border-zinc-100 px-4 py-2 text-xs leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
          输入过程中每隔约 20 秒自动留一份快照（最多 40 份）。点击时间即可把编辑区恢复到该版本；当前内容会自动转入「回退一步」的重做位。
        </p>

        <ul v-if="rows.length" class="flex-1 overflow-y-auto p-2">
          <li
            v-for="s in [...rows].reverse()"
            :key="s.t"
            class="mb-0.5 flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <span class="min-w-[150px] font-mono text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
              {{ fmtFull(s.t) }}
            </span>
            <span class="flex-1 text-[11px] text-zinc-400 dark:text-zinc-500">{{ s.c.length }} 字符</span>
            <button class="btn" @click="restoreSnapshot(s.t)">恢复</button>
          </li>
        </ul>

        <div v-else class="px-4 py-10 text-center text-xs text-zinc-400 dark:text-zinc-500">
          暂无快照 —— 输入内容后会自动开始记录。
        </div>
      </div>
    </div>
  </Transition>
</template>
