<script setup lang="ts">
/**
 * 设置弹窗：上部整宽顶栏（搜索框 + 命中下拉），下部左侧分页导航 + 右侧内容。
 *
 * 搜索实现：所有设置项登记在 SETTINGS 索引里（含 id / 所属分页 / 关键词），
 * 命中后 `jumpTo()` 切页 → 滚动到对应设置行 → 短暂高亮，便于用户定位。
 */
import { computed, nextTick, ref, watch } from 'vue'
import {
  Download,
  FileText,
  HardDrive,
  Image as ImageIcon,
  Languages,
  Moon,
  Search,
  SquareDashed,
  Sun,
  Upload,
  X,
} from '@lucide/vue'
import { fuzzyScore } from '../lib/commands'
import { LOCALES, locale, t } from '../lib/i18n'
import {
  backupAll,
  changeLocale,
  clearBackgroundImage,
  closeSettings,
  docs,
  importBackupFile,
  setBackgroundBlur,
  setBackgroundImage,
  setBackgroundOpacity,
  setDark,
  setEditorTint,
  st,
} from '../store'

type PageId = 'appearance' | 'data'

interface SettingItem {
  id: string
  page: PageId
  labelKey: string
  keywords: string[]
}

const PAGES: { id: PageId; labelKey: string }[] = [
  { id: 'appearance', labelKey: 'settings.page.appearance' },
  { id: 'data', labelKey: 'settings.page.data' },
]

const SETTINGS: SettingItem[] = [
  {
    id: 'appearance.theme',
    page: 'appearance',
    labelKey: 'settings.appearance.theme',
    keywords: ['theme', 'dark', 'light', '主题', '深色', '浅色'],
  },
  {
    id: 'appearance.language',
    page: 'appearance',
    labelKey: 'settings.appearance.language',
    keywords: ['language', 'locale', 'i18n', '语言', '中文', 'english'],
  },
  {
    id: 'appearance.background',
    page: 'appearance',
    labelKey: 'settings.appearance.background',
    keywords: ['background', 'wallpaper', 'image', 'picture', '背景', '壁纸', '图片'],
  },
  {
    id: 'appearance.blur',
    page: 'appearance',
    labelKey: 'settings.appearance.blur',
    keywords: ['blur', 'soften', '模糊', '虚化'],
  },
  {
    id: 'appearance.opacity',
    page: 'appearance',
    labelKey: 'settings.appearance.opacity',
    keywords: ['opacity', 'visibility', 'transparent', '可见度', '透明'],
  },
  {
    id: 'appearance.editorTint',
    page: 'appearance',
    labelKey: 'settings.appearance.editorTint',
    keywords: ['tint', 'panel', 'contrast', '底色', '对比度', '可读'],
  },
  {
    id: 'data.import',
    page: 'data',
    labelKey: 'settings.data.import',
    keywords: ['import', 'restore', 'json', '导入', '恢复'],
  },
  {
    id: 'data.backup',
    page: 'data',
    labelKey: 'settings.data.backup',
    keywords: ['backup', 'export', 'json', '备份', '导出'],
  },
  {
    id: 'data.usage',
    page: 'data',
    labelKey: 'settings.data.usage',
    keywords: ['storage', 'quota', 'usage', 'localstorage', '占用', '存储'],
  },
  {
    id: 'data.drafts',
    page: 'data',
    labelKey: 'settings.data.drafts',
    keywords: ['drafts', 'count', 'notes', '草稿', '数量'],
  },
]

const page = ref<PageId>('appearance')
const query = ref('')
const active = ref(0)
const highlight = ref('')
const searchEl = ref<HTMLInputElement | null>(null)
const contentEl = ref<HTMLElement | null>(null)
const bgInput = ref<HTMLInputElement | null>(null)
const jsonInput = ref<HTMLInputElement | null>(null)
let highlightTimer: ReturnType<typeof setTimeout> | undefined

const results = computed(() => {
  const q = query.value.trim()
  if (!q) return []
  return SETTINGS.map((item, index) => {
    const haystack = [t(item.labelKey), item.id, ...item.keywords].join(' ')
    return { item, score: fuzzyScore(q, haystack) * 1000 - index }
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item)
})

const selectedPage = computed(() => t(PAGES.find((p) => p.id === page.value)?.labelKey ?? ''))

function selectPage(id: PageId): void {
  page.value = id
  highlight.value = ''
}

/** 搜索命中 → 切页 + 滚动到该设置项 + 高亮 */
function jumpTo(item: SettingItem): void {
  page.value = item.page
  query.value = ''
  void nextTick(() => {
    const el = contentEl.value?.querySelector<HTMLElement>(`[data-setting-row="${item.id}"]`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    highlight.value = item.id
    clearTimeout(highlightTimer)
    highlightTimer = setTimeout(() => {
      if (highlight.value === item.id) highlight.value = ''
    }, 1800)
  })
}

function rowClass(id: string): string {
  return highlight.value === id
    ? 'ring-2 ring-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/40'
    : ''
}

function onSearchKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (results.value.length) active.value = (active.value + 1) % results.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (results.value.length) active.value = (active.value - 1 + results.value.length) % results.value.length
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const hit = results.value[active.value] ?? results.value[0]
    if (hit) jumpTo(hit)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    if (query.value) {
      query.value = ''
    } else {
      closeSettings()
    }
  }
}

function onBackgroundFile(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void setBackgroundImage(file)
  input.value = ''
}

function onJsonFile(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) importBackupFile(file)
  input.value = ''
}

function onOpacity(e: Event): void {
  setBackgroundOpacity(Number((e.target as HTMLInputElement).value))
}

function onBlur(e: Event): void {
  setBackgroundBlur(Number((e.target as HTMLInputElement).value))
}

/** 每次打开：清空搜索词并把焦点放进搜索框（组件常驻挂载，输入框要等 v-if 渲染完） */
watch(
  () => st.settingsOpen,
  (open) => {
    if (!open) return
    query.value = ''
    active.value = 0
    void nextTick(() => searchEl.value?.focus())
  },
)
</script>

<template>
  <Transition name="fade">
    <div
      v-if="st.settingsOpen"
      data-testid="settings-modal"
      class="fixed inset-0 z-[72] grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]"
      @click.self="closeSettings()"
    >
      <Transition name="pop" appear>
        <div
          class="flex h-[34rem] max-h-[86vh] w-[52rem] max-w-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-[var(--surface)] shadow-2xl dark:border-white/10"
        >
          <!-- ① 上部整宽顶栏：搜索 -->
          <div class="relative shrink-0 border-b border-zinc-200 dark:border-zinc-800">
            <div class="flex items-center gap-2 px-3 py-2.5">
              <Search class="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
              <input
                ref="searchEl"
                v-model="query"
                data-testid="settings-search"
                :placeholder="t('settings.searchPlaceholder')"
                class="w-full bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
                @keydown="onSearchKeydown"
                @input="active = 0"
              />
              <span class="hidden shrink-0 text-[10px] text-zinc-400 sm:inline">{{ t('settings.title') }}</span>
              <button
                data-testid="settings-close"
                class="btn btn-icon shrink-0"
                :title="t('dialog.close')"
                @click="closeSettings()"
              >
                <X class="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <!-- 搜索命中下拉 -->
            <div
              v-if="query.trim()"
              data-testid="settings-results"
              class="absolute inset-x-2 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-zinc-200 bg-[var(--surface)] py-1 shadow-xl dark:border-zinc-700"
            >
              <button
                v-for="(item, i) in results"
                :key="item.id"
                :data-setting="item.id"
                :data-active="i === active"
                class="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-left text-xs transition-colors"
                :class="i === active ? 'bg-indigo-500 text-white' : 'text-zinc-700 hover:bg-[var(--surface-2)] dark:text-zinc-200 '"
                @mousemove="active = i"
                @click="jumpTo(item)"
              >
                <span class="truncate">{{ t(item.labelKey) }}</span>
                <span
                  class="shrink-0 text-[10px]"
                  :class="i === active ? 'text-white/80' : 'text-zinc-400 dark:text-zinc-500'"
                >
                  {{ t(PAGES.find((p) => p.id === item.page)?.labelKey ?? '') }}
                </span>
              </button>
              <div v-if="!results.length" class="px-3 py-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
                {{ t('settings.noResults') }}
              </div>
            </div>
          </div>

          <!-- ② 下部：左侧分页 + 右侧内容 -->
          <div class="flex min-h-0 flex-1">
            <nav
              data-testid="settings-nav"
              class="w-44 shrink-0 overflow-y-auto border-r border-zinc-200 bg-[var(--surface-2)] p-1.5 dark:border-zinc-800"
            >
              <button
                v-for="p in PAGES"
                :key="p.id"
                :data-page="p.id"
                :data-active="page === p.id"
                class="mb-0.5 flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors"
                :class="page === p.id ? 'bg-[var(--surface)] font-medium text-indigo-600 shadow-sm dark:text-indigo-300' : 'text-zinc-600 hover:bg-[var(--surface-2)] dark:text-zinc-300 '"
                @click="selectPage(p.id)"
              >
                <ImageIcon v-if="p.id === 'appearance'" class="h-3.5 w-3.5" aria-hidden="true" />
                <HardDrive v-else class="h-3.5 w-3.5" aria-hidden="true" />
                {{ t(p.labelKey) }}
              </button>
            </nav>

            <div ref="contentEl" data-testid="settings-content" class="min-w-0 flex-1 overflow-y-auto p-4">
              <!-- ============ 外观 ============ -->
              <template v-if="page === 'appearance'">
                <section class="mb-2 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
                  {{ selectedPage }}
                </section>

                <div
                  :data-setting-row="'appearance.theme'"
                  class="mb-2 rounded-xl border border-zinc-200 p-3 transition-all dark:border-zinc-700"
                  :class="rowClass('appearance.theme')"
                >
                  <div class="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                    {{ t('settings.appearance.theme') }}
                  </div>
                  <div class="flex gap-2">
                    <button
                      data-testid="theme-light"
                      class="btn"
                      :class="!st.dark ? 'border-indigo-400 text-indigo-600 dark:text-indigo-300' : ''"
                      @click="setDark(false)"
                    >
                      <Sun class="h-3.5 w-3.5" aria-hidden="true" />
                      {{ t('settings.appearance.theme.light') }}
                    </button>
                    <button
                      data-testid="theme-dark"
                      class="btn"
                      :class="st.dark ? 'border-indigo-400 text-indigo-600 dark:text-indigo-300' : ''"
                      @click="setDark(true)"
                    >
                      <Moon class="h-3.5 w-3.5" aria-hidden="true" />
                      {{ t('settings.appearance.theme.dark') }}
                    </button>
                  </div>
                </div>

                <div
                  :data-setting-row="'appearance.language'"
                  class="mb-2 rounded-xl border border-zinc-200 p-3 transition-all dark:border-zinc-700"
                  :class="rowClass('appearance.language')"
                >
                  <div class="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                    <Languages class="h-3.5 w-3.5" aria-hidden="true" />
                    {{ t('settings.appearance.language') }}
                  </div>
                  <div class="flex gap-2">
                    <button
                      v-for="l in LOCALES"
                      :key="l.id"
                      :data-locale="l.id"
                      class="btn"
                      :class="locale === l.id ? 'border-indigo-400 text-indigo-600 dark:text-indigo-300' : ''"
                      @click="changeLocale(l.id)"
                    >
                      {{ l.label }}
                    </button>
                  </div>
                </div>

                <div
                  :data-setting-row="'appearance.background'"
                  class="mb-2 rounded-xl border border-zinc-200 p-3 transition-all dark:border-zinc-700"
                  :class="rowClass('appearance.background')"
                >
                  <div class="mb-1 flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                    <ImageIcon class="h-3.5 w-3.5" aria-hidden="true" />
                    {{ t('settings.appearance.background') }}
                  </div>
                  <p class="mb-2 text-[11px] leading-4 text-zinc-400 dark:text-zinc-500">
                    {{ t('settings.appearance.backgroundHint') }}
                  </p>
                  <div class="flex flex-wrap items-center gap-2">
                    <button data-testid="bg-choose" class="btn" @click="bgInput?.click()">
                      <Upload class="h-3.5 w-3.5" aria-hidden="true" />
                      {{ t('settings.appearance.choose') }}
                    </button>
                    <button
                      v-if="st.appearance.imageUrl"
                      data-testid="bg-clear"
                      class="btn"
                      @click="clearBackgroundImage()"
                    >
                      <X class="h-3.5 w-3.5" aria-hidden="true" />
                      {{ t('settings.appearance.clear') }}
                    </button>
                    <span
                      data-testid="bg-status"
                      class="text-[11px]"
                      :class="st.appearance.imageUrl ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500'"
                    >
                      {{ st.appearance.imageUrl ? t('settings.appearance.current') : t('settings.appearance.none') }}
                    </span>
                    <input
                      ref="bgInput"
                      data-testid="bg-input"
                      type="file"
                      accept="image/*"
                      class="hidden"
                      @change="onBackgroundFile"
                    />
                    <img
                      v-if="st.appearance.imageUrl"
                      :src="st.appearance.imageUrl"
                      alt=""
                      data-testid="bg-thumb"
                      class="h-10 w-16 rounded-md border border-zinc-200 object-cover dark:border-zinc-700"
                    />
                  </div>
                </div>

                <div
                  :data-setting-row="'appearance.blur'"
                  class="mb-2 rounded-xl border border-zinc-200 p-3 transition-all dark:border-zinc-700"
                  :class="rowClass('appearance.blur')"
                >
                  <div class="mb-1 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                    {{ t('settings.appearance.blur') }}
                  </div>
                  <p class="mb-2 text-[11px] leading-4 text-zinc-400 dark:text-zinc-500">
                    {{ t('settings.appearance.blurHint') }}
                  </p>
                  <div class="flex items-center gap-3">
                    <input
                      data-testid="bg-blur"
                      type="range"
                      min="0"
                      max="40"
                      step="1"
                      :value="st.appearance.blur"
                      :disabled="!st.appearance.imageUrl"
                      class="h-1.5 w-56 cursor-pointer accent-indigo-500 disabled:opacity-40"
                      @input="onBlur"
                    />
                    <span class="w-10 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                      {{ st.appearance.blur }}px
                    </span>
                  </div>
                </div>

                <div
                  :data-setting-row="'appearance.opacity'"
                  class="mb-2 rounded-xl border border-zinc-200 p-3 transition-all dark:border-zinc-700"
                  :class="rowClass('appearance.opacity')"
                >
                  <div class="mb-1 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                    {{ t('settings.appearance.opacity') }}
                  </div>
                  <p class="mb-2 text-[11px] leading-4 text-zinc-400 dark:text-zinc-500">
                    {{ t('settings.appearance.opacityHint') }}
                  </p>
                  <div class="flex items-center gap-3">
                    <input
                      data-testid="bg-opacity"
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      :value="st.appearance.opacity"
                      :disabled="!st.appearance.imageUrl"
                      class="h-1.5 w-56 cursor-pointer accent-indigo-500 disabled:opacity-40"
                      @input="onOpacity"
                    />
                    <span class="w-10 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                      {{ st.appearance.opacity }}%
                    </span>
                  </div>
                </div>

                <div
                  :data-setting-row="'appearance.editorTint'"
                  class="mb-2 rounded-xl border border-zinc-200 p-3 transition-all dark:border-zinc-700"
                  :class="rowClass('appearance.editorTint')"
                >
                  <div class="mb-1 flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                    <SquareDashed class="h-3.5 w-3.5" aria-hidden="true" />
                    {{ t('settings.appearance.editorTint') }}
                  </div>
                  <p class="mb-2 text-[11px] leading-4 text-zinc-400 dark:text-zinc-500">
                    {{ t('settings.appearance.editorTintHint') }}
                  </p>
                  <div class="flex gap-2">
                    <button
                      data-testid="editor-tint-on"
                      class="btn"
                      :class="st.appearance.editorTint ? 'border-indigo-400 text-indigo-600 dark:text-indigo-300' : ''"
                      :disabled="!st.appearance.imageUrl"
                      @click="setEditorTint(true)"
                    >
                      {{ t('settings.toggle.on') }}
                    </button>
                    <button
                      data-testid="editor-tint-off"
                      class="btn"
                      :class="!st.appearance.editorTint ? 'border-indigo-400 text-indigo-600 dark:text-indigo-300' : ''"
                      :disabled="!st.appearance.imageUrl"
                      @click="setEditorTint(false)"
                    >
                      {{ t('settings.toggle.off') }}
                    </button>
                  </div>
                </div>
              </template>

              <!-- ============ 数据 ============ -->
              <template v-else>
                <section class="mb-2 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
                  {{ selectedPage }}
                </section>

                <div
                  :data-setting-row="'data.import'"
                  class="mb-2 rounded-xl border border-zinc-200 p-3 transition-all dark:border-zinc-700"
                  :class="rowClass('data.import')"
                >
                  <div class="mb-1 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                    {{ t('settings.data.import') }}
                  </div>
                  <p class="mb-2 text-[11px] leading-4 text-zinc-400 dark:text-zinc-500">
                    {{ t('settings.data.importHint') }}
                  </p>
                  <button data-testid="data-import" class="btn" @click="jsonInput?.click()">
                    <Upload class="h-3.5 w-3.5" aria-hidden="true" />
                    {{ t('settings.data.import') }}
                  </button>
                  <input
                    ref="jsonInput"
                    data-testid="data-json-input"
                    type="file"
                    accept=".json,application/json"
                    class="hidden"
                    @change="onJsonFile"
                  />
                </div>

                <div
                  :data-setting-row="'data.backup'"
                  class="mb-2 rounded-xl border border-zinc-200 p-3 transition-all dark:border-zinc-700"
                  :class="rowClass('data.backup')"
                >
                  <div class="mb-1 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                    {{ t('settings.data.backup') }}
                  </div>
                  <p class="mb-2 text-[11px] leading-4 text-zinc-400 dark:text-zinc-500">
                    {{ t('settings.data.backupHint') }}
                  </p>
                  <button data-testid="data-backup" class="btn" @click="backupAll()">
                    <Download class="h-3.5 w-3.5" aria-hidden="true" />
                    {{ t('settings.data.backup') }}
                  </button>
                </div>

                <div
                  :data-setting-row="'data.usage'"
                  class="mb-2 flex items-center justify-between rounded-xl border border-zinc-200 p-3 transition-all dark:border-zinc-700"
                  :class="rowClass('data.usage')"
                >
                  <span class="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                    <HardDrive class="h-3.5 w-3.5" aria-hidden="true" />
                    {{ t('settings.data.usage') }}
                  </span>
                  <span
                    data-testid="data-usage"
                    class="font-mono text-xs"
                    :class="st.quotaWarn ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500 dark:text-zinc-400'"
                  >
                    {{ st.quotaSize || '—' }}
                  </span>
                </div>

                <div
                  :data-setting-row="'data.drafts'"
                  class="mb-2 flex items-center justify-between rounded-xl border border-zinc-200 p-3 transition-all dark:border-zinc-700"
                  :class="rowClass('data.drafts')"
                >
                  <span class="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                    <FileText class="h-3.5 w-3.5" aria-hidden="true" />
                    {{ t('settings.data.drafts') }}
                  </span>
                  <span data-testid="data-drafts" class="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {{ t('settings.data.draftsValue', { n: docs.length }) }}
                  </span>
                </div>
              </template>
            </div>
          </div>

          <div
            class="shrink-0 border-t border-zinc-200 px-4 py-1.5 text-[10px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500"
          >
            {{ t('settings.searchHint') }}
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
