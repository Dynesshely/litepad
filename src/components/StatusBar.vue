<script setup lang="ts">
import { computed, ref } from 'vue'
import { currentEncoding, setCurrentEncoding, st } from '../store'
import { encodingLabel } from '../lib/encoding'
import EncodingMenu from './EncodingMenu.vue'

const menuOpen = ref(false)

const dotClass = computed(() => {
  switch (st.saveKind) {
    case 'ok':
      return 'bg-emerald-500'
    case 'dirty':
      return 'animate-pulse bg-amber-400'
    case 'err':
      return 'bg-red-500'
    default:
      return 'bg-zinc-300 dark:bg-zinc-600'
  }
})

const msgClass = computed(() => {
  switch (st.saveKind) {
    case 'ok':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'dirty':
      return 'text-amber-600 dark:text-amber-400'
    case 'err':
      return 'text-red-600 dark:text-red-400'
    default:
      return ''
  }
})

const encLabel = computed(() => encodingLabel(currentEncoding.value))

function onSelect(id: string): void {
  setCurrentEncoding(id)
}
</script>

<template>
  <footer
    class="relative flex min-h-7 flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-zinc-200 bg-white px-3 py-1 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
  >
    <span class="inline-flex items-center gap-1.5">
      <span class="h-1.5 w-1.5 rounded-full" :class="dotClass"></span>
      <span :class="msgClass">{{ st.saveMsg }}</span>
    </span>

    <!-- 文本编码：显示当前草稿编码，点击可手动指定 -->
    <button
      data-testid="enc-btn"
      class="cursor-pointer rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
      :class="menuOpen ? 'bg-zinc-100 text-indigo-600 dark:bg-zinc-800 dark:text-indigo-300' : ''"
      title="当前草稿的文本编码：决定 .txt 导出的字节，以及导入 .txt 时的解读方式"
      @click="menuOpen = !menuOpen"
    >
      {{ encLabel }}
    </button>

    <span
      class="tabular-nums"
      :class="st.quotaWarn ? 'font-semibold text-amber-600 dark:text-amber-400' : ''"
    >
      {{ st.quota }}
    </span>

    <span v-if="st.chars" class="ml-auto tabular-nums">{{ st.chars }} 字符 · {{ st.lines }} 行</span>

    <EncodingMenu
      v-if="menuOpen"
      :current="currentEncoding"
      @select="onSelect"
      @close="menuOpen = false"
    />
  </footer>
</template>
