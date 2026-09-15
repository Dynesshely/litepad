<script setup lang="ts">
import { ref } from 'vue'
import { encodingLabel, groupedEncodings, isDecodable } from '../lib/encoding'
import { t } from '../lib/i18n'
import { Check, Import } from '@lucide/vue'
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
    showToast(t('enc.unsupported', { enc: encodingLabel(id) }))
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
    class="absolute right-0 bottom-full z-50 mb-1.5 max-h-[62vh] w-80 overflow-y-auto rounded-xl border border-zinc-200 bg-[var(--surface)] p-1.5 shadow-xl dark:border-zinc-700"
  >
    <div class="px-2 py-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
      {{ t('enc.current') }}
    </div>

    <template v-for="g in groups" :key="g.groupKey">
      <div class="px-2 pt-1.5 pb-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">
        {{ t(g.groupKey) }}
      </div>
      <button
        v-for="e in g.items"
        :key="e.id"
        :data-enc="e.id"
        class="flex w-full cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-40"
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
          <span v-if="e.hintKey">{{ t(e.hintKey) }}</span>
          <Check v-if="e.id === current" class="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
        </span>
      </button>
    </template>

    <div class="my-1 border-t border-zinc-200 dark:border-zinc-700"></div>

    <button
      data-testid="enc-import"
      class="flex w-full cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-left text-xs text-zinc-700 transition-colors hover:bg-[var(--surface-2)] dark:text-zinc-200"
      @click="fileInput?.click()"
    >
      <Import class="h-3.5 w-3.5" aria-hidden="true" />
      {{ t('enc.import') }}
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
      {{ t('enc.note') }}
    </p>
  </div>
</template>
