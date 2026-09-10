<script setup lang="ts">
import { LOCALES } from '../lib/i18n'

defineProps<{ current: string }>()
const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'close'): void
}>()

function pick(id: string): void {
  emit('select', id)
  emit('close')
}
</script>

<template>
  <!-- 点击菜单外任意处关闭 -->
  <div class="fixed inset-0 z-40" @click="emit('close')"></div>

  <div
    data-testid="locale-menu"
    class="absolute right-0 top-full z-50 mt-1.5 w-40 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
  >
    <button
      v-for="l in LOCALES"
      :key="l.id"
      :data-locale="l.id"
      class="flex w-full cursor-pointer items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
      :class="
        l.id === current
          ? 'font-semibold text-indigo-600 dark:text-indigo-300'
          : 'text-zinc-700 dark:text-zinc-200'
      "
      @click="pick(l.id)"
    >
      <span>{{ l.label }}</span>
      <span v-if="l.id === current" class="text-indigo-500">✓</span>
    </button>
  </div>
</template>
