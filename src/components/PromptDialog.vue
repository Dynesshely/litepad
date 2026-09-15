<script setup lang="ts">
/**
 * 命令弹框：input 模式用于收集参数（如「多行转单行」的连接符），
 * info 模式用于展示只读命令结果（如文本统计）。Enter 确定、Esc 取消。
 */
import { onMounted, ref } from 'vue'
import { cancelPrompt, closeDialog, st, submitPrompt } from '../store'
import { t } from '../lib/i18n'

const inputEl = ref<HTMLInputElement | null>(null)

onMounted(() => {
  if (st.dialog.mode === 'input') {
    inputEl.value?.focus()
    inputEl.value?.select()
  }
})

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter') {
    e.preventDefault()
    if (st.dialog.mode === 'input') submitPrompt()
    else closeDialog()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    cancelPrompt()
  }
}
</script>

<template>
  <Transition name="fade">
    <div
      v-if="st.dialog.open"
      data-testid="dialog"
      class="fixed inset-0 z-[75] grid place-items-center bg-black/40 p-4 backdrop-blur-[1px]"
      @click.self="cancelPrompt()"
    >
      <Transition name="pop" appear>
        <div
          class="w-[26rem] max-w-full overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-900"
        >
          <div
            class="border-b border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
          >
            {{ st.dialog.title }}
          </div>

          <div class="px-4 py-3">
            <template v-if="st.dialog.mode === 'input'">
              <label class="mb-1 block text-[11px] text-zinc-500 dark:text-zinc-400">
                {{ st.dialog.label }}
              </label>
              <input
                ref="inputEl"
                v-model="st.dialog.value"
                data-testid="dialog-input"
                :placeholder="st.dialog.placeholder"
                class="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-sm text-zinc-800 outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                @keydown="onKeydown"
              />
            </template>

            <dl v-else class="space-y-1 text-xs">
              <div
                v-for="row in st.dialog.rows"
                :key="row.label"
                class="flex items-baseline justify-between gap-4 border-b border-dashed border-zinc-200 pb-1 last:border-0 last:pb-0 dark:border-zinc-700"
              >
                <dt class="text-zinc-500 dark:text-zinc-400">{{ row.label }}</dt>
                <dd class="font-mono text-zinc-800 dark:text-zinc-100">{{ row.value }}</dd>
              </div>
            </dl>
          </div>

          <div class="flex justify-end gap-2 border-t border-zinc-200 px-4 py-2.5 dark:border-zinc-700">
            <template v-if="st.dialog.mode === 'input'">
              <button data-testid="dialog-cancel" class="btn" @click="cancelPrompt()">
                {{ t('dialog.cancel') }}
              </button>
              <button
                data-testid="dialog-ok"
                class="btn border-indigo-400 text-indigo-600 dark:border-indigo-400 dark:text-indigo-300"
                @click="submitPrompt()"
              >
                {{ t('dialog.ok') }}
              </button>
            </template>
            <button v-else data-testid="dialog-close" class="btn" @click="closeDialog()">
              {{ t('dialog.close') }}
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
