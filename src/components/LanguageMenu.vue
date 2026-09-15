<script setup lang="ts">
/**
 * 底栏语言选择菜单（代码着色）：
 * 顶部固定「自动检测 / 纯文本」，其余按「常用 / 全部」分组，并支持搜索过滤。
 * 语言名称取自 Monaco 注册表（`langRegistry`），因此与编辑器实际可用的语言完全一致。
 */
import { computed, nextTick, onMounted, ref } from 'vue'
import { Check, Search, Wand2 } from '@lucide/vue'
import { fuzzyScore } from '../lib/commands'
import { AUTO_LANG, PLAINTEXT } from '../lib/languages'
import { commonLanguages, otherLanguages } from '../lib/langRegistry'
import { t } from '../lib/i18n'
import { closeLangMenu, currentLang, langName, setCurrentLang, st } from '../store'

const query = ref('')
const input = ref<HTMLInputElement | null>(null)

// 纯文本单独放在顶部按钮里，不再在「常用」分组里重复一次
const common = commonLanguages().filter((l) => l.id !== PLAINTEXT)
const others = otherLanguages()

function matches(id: string, label: string, extra: string[] = []): boolean {
  const q = query.value.trim()
  if (!q) return true
  // fuzzyScore 用 -1 表示不匹配（不是 null）
  return fuzzyScore(q, [label, id, ...extra].join(' ').toLowerCase()) >= 0
}

const filteredCommon = computed(() => common.filter((l) => matches(l.id, l.label)))
const filteredOthers = computed(() => others.filter((l) => matches(l.id, l.label)))
/** 搜索时把「自动检测 / 纯文本」也纳入过滤，避免它们永远挂在顶部造成误解 */
const showAuto = computed(() => matches(AUTO_LANG, t('lang.auto'), ['auto', 'detect', '自动']))
const showPlain = computed(() => matches(PLAINTEXT, t('lang.plain'), ['text', 'plain', '纯文本']))
const empty = computed(
  () => !showAuto.value && !showPlain.value && !filteredCommon.value.length && !filteredOthers.value.length,
)

function pick(id: string): void {
  setCurrentLang(id)
  closeLangMenu()
}

onMounted(async () => {
  await nextTick()
  input.value?.focus()
})
</script>

<template>
  <!-- 点击菜单外任意处关闭 -->
  <div class="fixed inset-0 z-40" @click="closeLangMenu()"></div>

  <div
    data-testid="lang-menu"
    class="absolute right-0 bottom-full z-50 mb-1.5 flex max-h-[62vh] w-72 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-[var(--surface)] shadow-xl dark:border-zinc-700"
  >
    <div class="flex items-center gap-1.5 border-b border-zinc-200 px-2 py-1.5 dark:border-zinc-700">
      <Search class="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
      <input
        ref="input"
        v-model="query"
        data-testid="lang-search"
        type="text"
        :placeholder="t('lang.search')"
        class="w-full bg-transparent text-xs text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
        @keydown.esc.prevent="closeLangMenu()"
      />
    </div>

    <div class="overflow-y-auto p-1.5">
      <button
        v-if="showAuto"
        data-testid="lang-item-auto"
        class="flex w-full cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-[var(--surface-2)]"
        @click="pick(AUTO_LANG)"
      >
        <span
          class="flex items-center gap-1.5"
          :class="currentLang === AUTO_LANG ? 'font-semibold text-indigo-600 dark:text-indigo-300' : 'text-zinc-700 dark:text-zinc-200'"
        >
          <Wand2 class="h-3.5 w-3.5" aria-hidden="true" />
          {{ t('lang.auto') }}
        </span>
        <span class="flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
          <span v-if="currentLang === AUTO_LANG" data-testid="lang-auto-detected">
            {{ langName(st.resolvedLang) }}
          </span>
          <Check v-if="currentLang === AUTO_LANG" class="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
        </span>
      </button>

      <button
        v-if="showPlain"
        :data-lang="PLAINTEXT"
        data-testid="lang-item-plaintext"
        class="flex w-full cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-[var(--surface-2)]"
        @click="pick(PLAINTEXT)"
      >
        <span
          :class="currentLang === PLAINTEXT ? 'font-semibold text-indigo-600 dark:text-indigo-300' : 'text-zinc-700 dark:text-zinc-200'"
        >
          {{ t('lang.plain') }}
        </span>
        <Check v-if="currentLang === PLAINTEXT" class="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
      </button>

      <div
        v-if="filteredCommon.length"
        class="px-2 pt-1.5 pb-0.5 text-[10px] text-zinc-400 dark:text-zinc-500"
      >
        {{ t('lang.group.common') }}
      </div>
      <button
        v-for="l in filteredCommon"
        :key="l.id"
        :data-lang="l.id"
        class="flex w-full cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-[var(--surface-2)]"
        @click="pick(l.id)"
      >
        <span
          :class="l.id === currentLang ? 'font-semibold text-indigo-600 dark:text-indigo-300' : 'text-zinc-700 dark:text-zinc-200'"
        >
          {{ l.label }}
        </span>
        <Check v-if="l.id === currentLang" class="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
      </button>

      <div
        v-if="filteredOthers.length"
        class="px-2 pt-1.5 pb-0.5 text-[10px] text-zinc-400 dark:text-zinc-500"
      >
        {{ t('lang.group.all') }}
      </div>
      <button
        v-for="l in filteredOthers"
        :key="l.id"
        :data-lang="l.id"
        class="flex w-full cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-[var(--surface-2)]"
        @click="pick(l.id)"
      >
        <span
          :class="l.id === currentLang ? 'font-semibold text-indigo-600 dark:text-indigo-300' : 'text-zinc-700 dark:text-zinc-200'"
        >
          {{ l.label }}
        </span>
        <Check v-if="l.id === currentLang" class="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
      </button>

      <p
        v-if="empty"
        data-testid="lang-empty"
        class="px-2 py-2 text-[11px] text-zinc-400 dark:text-zinc-500"
      >
        {{ t('lang.noMatch') }}
      </p>
    </div>

    <p class="border-t border-zinc-200 px-2 py-1 text-[10px] leading-4 text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
      {{ t('lang.note') }}
    </p>
  </div>
</template>
