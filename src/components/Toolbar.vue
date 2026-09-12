<script setup lang="ts">
import { ref } from 'vue'
import {
  st,
  backupAll,
  changeLocale,
  createNewDoc,
  exportCurrentTxt,
  importBackupFile,
  openAbout,
  openHistory,
  toggleDark,
  toggleSidebar,
  undoOneStep,
} from '../store'
import { locale, localeShort, t } from '../lib/i18n'
import LocaleMenu from './LocaleMenu.vue'
import BrandLogo from './BrandLogo.vue'

const fileInput = ref<HTMLInputElement | null>(null)
const langOpen = ref(false)

function onFile(e: Event): void {
  const input = e.target as HTMLInputElement
  if (input.files && input.files[0]) importBackupFile(input.files[0])
  input.value = ''
}

function onLocale(id: string): void {
  changeLocale(id)
}
</script>

<template>
  <header
    class="flex flex-wrap items-center gap-1.5 border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
  >
    <!-- 品牌区即「关于」入口（点 Logo 或名称打开，类似 macOS 的关于面板） -->
    <button
      data-testid="brand"
      class="mr-2 flex cursor-pointer select-none items-center gap-1.5 rounded-md px-1 py-0.5 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
      :title="t('about.open')"
      @click="openAbout()"
    >
      <BrandLogo />
      {{ t('app.title') }}
    </button>

    <button class="btn" :title="t('tb.newTitle')" @click="createNewDoc()">{{ t('tb.new') }}</button>
    <button
      data-testid="list-toggle"
      class="btn"
      :class="st.sidebarPinned ? 'border-indigo-400 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300' : ''"
      :title="st.sidebarPinned ? t('tb.docsPinnedTitle') : t('tb.docsTitle')"
      @click="toggleSidebar()"
    >
      {{ st.sidebarPinned ? t('tb.docsPinned') : t('tb.docs') }}
    </button>
    <button class="btn" :disabled="!st.currentId" :title="t('tb.historyTitle')" @click="openHistory()">
      {{ t('tb.history') }}
    </button>
    <button class="btn" :disabled="!st.currentId" :title="t('tb.undoTitle')" @click="undoOneStep()">
      {{ t('tb.undo') }}
    </button>

    <span class="mx-1 hidden h-4 w-px bg-zinc-200 sm:block dark:bg-zinc-700"></span>

    <button class="btn" :disabled="!st.currentId" :title="t('tb.exportTitle')" @click="exportCurrentTxt()">
      {{ t('tb.export') }}
    </button>
    <button class="btn" :title="t('tb.backupTitle')" @click="backupAll()">{{ t('tb.backup') }}</button>
    <button class="btn" :title="t('tb.importTitle')" @click="fileInput?.click()">{{ t('tb.import') }}</button>
    <input ref="fileInput" type="file" accept=".json,application/json" class="hidden" @change="onFile" />

    <div class="flex-1"></div>

    <!-- 语言切换：紧邻主题切换按钮的左侧 -->
    <div class="relative">
      <button
        data-testid="locale-btn"
        class="btn"
        :title="t('tb.lang')"
        @click="langOpen = !langOpen"
      >
        🌐 {{ localeShort() }}
      </button>
      <LocaleMenu v-if="langOpen" :current="locale" @select="onLocale" @close="langOpen = false" />
    </div>

    <button
      data-testid="theme-btn"
      class="btn"
      :title="st.dark ? t('tb.themeToLight') : t('tb.themeToDark')"
      @click="toggleDark()"
    >
      {{ st.dark ? '☀️' : '🌙' }}
    </button>
  </header>
</template>
