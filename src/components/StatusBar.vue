<script setup lang="ts">
import { computed } from 'vue'
import { st } from '../store'

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
</script>

<template>
  <footer
    class="flex min-h-7 flex-wrap items-center gap-x-4 gap-y-0.5 border-t border-zinc-200 bg-white px-3 py-1 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
  >
    <span class="inline-flex items-center gap-1.5">
      <span class="h-1.5 w-1.5 rounded-full" :class="dotClass"></span>
      <span :class="msgClass">{{ st.saveMsg }}</span>
    </span>

    <span
      class="tabular-nums"
      :class="st.quotaWarn ? 'font-semibold text-amber-600 dark:text-amber-400' : ''"
    >
      {{ st.quota }}
    </span>

    <span v-if="st.chars" class="ml-auto tabular-nums">
      {{ st.chars }} 字符 · {{ st.lines }} 行
    </span>
  </footer>
</template>
