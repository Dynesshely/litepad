<script setup lang="ts">
import { computed } from 'vue'
import { dismissBanner, st } from '../store'
import { t } from '../lib/i18n'
import { CircleAlert, Info, TriangleAlert, X } from '@lucide/vue'

const cls = computed(() => {
  switch (st.banner?.kind) {
    case 'warn':
      return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300'
    case 'error':
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300'
    default:
      return 'border-zinc-200 bg-[var(--surface-2)] text-zinc-600 dark:border-zinc-800 dark:text-zinc-400'
  }
})
</script>

<template>
  <div
    v-if="st.banner"
    class="flex items-start gap-2 border-b px-3 py-1.5 text-xs"
    :class="cls"
  >
    <TriangleAlert v-if="st.banner.kind === 'warn'" class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    <CircleAlert v-else-if="st.banner.kind === 'error'" class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    <Info v-else class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    <span class="flex-1 whitespace-pre-wrap break-words">{{ st.banner.msg }}</span>
    <button
      class="cursor-pointer rounded px-1 text-sm font-bold leading-none opacity-70 transition-opacity hover:opacity-100"
      :title="t('banner.dismiss')"
      @click="dismissBanner()"
    >
      <X class="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  </div>
</template>
