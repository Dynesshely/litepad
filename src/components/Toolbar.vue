<script setup lang="ts">
import { ref } from 'vue'
import {
  Command,
  Download,
  FilePlus2,
  History,
  Languages,
  Moon,
  PanelLeft,
  Settings,
  Sun,
  Undo2,
} from '@lucide/vue'
import {
  st,
  changeLocale,
  createNewDoc,
  exportCurrentTxt,
  openAbout,
  openHistory,
  openPalette,
  openSettings,
  toggleDark,
  toggleSidebar,
  undoOneStep,
} from '../store'
import { locale, localeShort, t } from '../lib/i18n'
import LocaleMenu from './LocaleMenu.vue'
import BrandLogo from './BrandLogo.vue'

const langOpen = ref(false)

function onLocale(id: string): void {
  changeLocale(id)
}
</script>

<template>
  <header
    class="flex flex-wrap items-center gap-1.5 border-b border-zinc-200 bg-[var(--surface)] px-3 py-2 dark:border-zinc-800"
  >
    <!-- 品牌区即「关于」入口（点 Logo 或名称打开，类似 macOS 的关于面板） -->
    <button
      data-testid="brand"
      class="mr-2 flex cursor-pointer select-none items-center gap-1.5 rounded-md px-1 py-0.5 text-sm font-semibold text-zinc-800 transition-colors hover:bg-[var(--surface-2)] dark:text-zinc-100"
      :title="t('about.open')"
      @click="openAbout()"
    >
      <BrandLogo />
      {{ t('app.title') }}
    </button>

    <button class="btn" :title="t('tb.newTitle')" @click="createNewDoc()">
      <FilePlus2 class="h-3.5 w-3.5" aria-hidden="true" />
      {{ t('tb.new') }}
    </button>
    <button
      data-testid="list-toggle"
      class="btn"
      :class="st.sidebarPinned ? 'border-indigo-400 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300' : ''"
      :title="st.sidebarPinned ? t('tb.docsPinnedTitle') : t('tb.docsTitle')"
      @click="toggleSidebar()"
    >
      <PanelLeft class="h-3.5 w-3.5" aria-hidden="true" />
      {{ st.sidebarPinned ? t('tb.docsPinned') : t('tb.docs') }}
    </button>
    <button class="btn" :disabled="!st.currentId" :title="t('tb.historyTitle')" @click="openHistory()">
      <History class="h-3.5 w-3.5" aria-hidden="true" />
      {{ t('tb.history') }}
    </button>
    <button class="btn" :disabled="!st.currentId" :title="t('tb.undoTitle')" @click="undoOneStep()">
      <Undo2 class="h-3.5 w-3.5" aria-hidden="true" />
      {{ t('tb.undo') }}
    </button>
    <button
      data-testid="palette-btn"
      class="btn"
      :disabled="!st.currentId"
      :title="t('cmd.openHint')"
      @click="openPalette()"
    >
      <Command class="h-3.5 w-3.5" aria-hidden="true" />
      {{ t('cmd.open') }}
    </button>

    <span class="mx-1 hidden h-4 w-px bg-zinc-200 sm:block dark:bg-zinc-700"></span>

    <button class="btn" :disabled="!st.currentId" :title="t('tb.exportTitle')" @click="exportCurrentTxt()">
      <Download class="h-3.5 w-3.5" aria-hidden="true" />
      {{ t('tb.export') }}
    </button>
    <div class="flex-1"></div>

    <button
      data-testid="settings-btn"
      class="btn"
      :title="t('settings.title')"
      @click="openSettings()"
    >
      <Settings class="h-3.5 w-3.5" aria-hidden="true" />
      {{ t('settings.title') }}
    </button>

    <!-- 语言切换：紧邻主题切换按钮的左侧 -->
    <div class="relative">
      <button data-testid="locale-btn" class="btn" :title="t('tb.lang')" @click="langOpen = !langOpen">
        <Languages class="h-3.5 w-3.5" aria-hidden="true" />
        {{ localeShort() }}
      </button>
      <LocaleMenu v-if="langOpen" :current="locale" @select="onLocale" @close="langOpen = false" />
    </div>

    <button
      data-testid="theme-btn"
      class="btn btn-icon"
      :title="st.dark ? t('tb.themeToLight') : t('tb.themeToDark')"
      @click="toggleDark()"
    >
      <Sun v-if="st.dark" class="h-4 w-4" aria-hidden="true" />
      <Moon v-else class="h-4 w-4" aria-hidden="true" />
    </button>
  </header>
</template>
