<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  closeLangMenu,
  currentEncoding,
  langDisplayName,
  repoUrl,
  setCurrentEncoding,
  st,
  toggleLangMenu,
} from '../store'
import { encodingLabel } from '../lib/encoding'
import { t } from '../lib/i18n'
import { timeHM } from '../lib/format'
import { ExternalLink } from '@lucide/vue'
import EncodingMenu from './EncodingMenu.vue'
import LanguageMenu from './LanguageMenu.vue'

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
/** 保存状态文案随语言实时翻译（saveKey + 可选时间戳） */
const saveText = computed(() => t(st.saveKey, { time: st.saveAt ? timeHM(st.saveAt) : '' }))

function onSelect(id: string): void {
  setCurrentEncoding(id)
}
</script>

<template>
  <footer
    class="relative flex min-h-7 flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-zinc-200 bg-[var(--surface)] px-3 py-1 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
  >
    <span class="inline-flex items-center gap-1.5">
      <span class="h-1.5 w-1.5 rounded-full" :class="dotClass"></span>
      <span :class="msgClass">{{ saveText }}</span>
    </span>

    <!-- 文本编码：显示当前草稿编码，点击可手动指定。
         刻意不用 font-mono：等宽字体的字面高度与基线位置和界面字体不同，
         同样 11px 下「UTF-8」会比旁边条目高约 1px（实测墨迹中心 13.75 vs 14.75）。 -->
    <button
      data-testid="enc-btn"
      class="cursor-pointer rounded px-1.5 py-0.5 text-[11px] transition-colors hover:bg-[var(--surface-2)]"
      :class="menuOpen ? 'bg-[var(--surface-2)] text-indigo-600 dark:text-indigo-300' : ''"
      :title="t('enc.current')"
      @click="menuOpen = !menuOpen"
    >
      {{ encLabel }}
    </button>

    <!-- 代码语言（着色）：显示当前草稿的语言，点击可手动指定或改为自动检测 -->
    <button
      data-testid="lang-btn"
      class="cursor-pointer rounded px-1.5 py-0.5 text-[11px] transition-colors hover:bg-[var(--surface-2)]"
      :class="st.langMenuOpen ? 'bg-[var(--surface-2)] text-indigo-600 dark:text-indigo-300' : ''"
      :title="t('lang.current')"
      @click="toggleLangMenu()"
    >
      {{ langDisplayName() }}
    </button>

    <span
      class="tabular-nums"
      :class="st.quotaWarn ? 'font-semibold text-amber-600 dark:text-amber-400' : ''"
    >
      {{ st.quota }}
    </span>

    <!-- 右侧组：GitHub 仓库入口（地址在构建期从 git remote 注入）排在字符统计左侧 -->
    <span class="ml-auto flex items-center gap-x-3">
      <a
        v-if="repoUrl"
        data-testid="repo-link"
        :href="repoUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-colors hover:bg-[var(--surface-2)] hover:text-indigo-600 dark:hover:text-indigo-300"
        :title="t('repo.open')"
        :aria-label="t('repo.open')"
      >
        <ExternalLink class="h-3.5 w-3.5" aria-hidden="true" />
        <span class="hidden sm:inline">{{ t('repo.label') }}</span>
      </a>

      <span v-if="st.chars" data-testid="chars-count" class="tabular-nums">
        {{ t('st.chars', { chars: st.chars, lines: st.lines }) }}
      </span>
    </span>

    <EncodingMenu
      v-if="menuOpen"
      :current="currentEncoding"
      @select="onSelect"
      @close="menuOpen = false"
    />

    <LanguageMenu v-if="st.langMenuOpen" @close="closeLangMenu()" />
  </footer>
</template>
