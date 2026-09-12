<script setup lang="ts">
/**
 * 「关于 Litepad」弹窗：版式模仿新版 macOS 的关于面板——
 * 顶部居中图标 / 应用名 / 版本号，中间为带细分割线的规格行，底部为操作按钮。
 */
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { closeAbout, currentMeta, docs, showToast, st } from '../store'
import { encodingLabel } from '../lib/encoding'
import { locale, localeLabel, t } from '../lib/i18n'
import BrandLogo from './BrandLogo.vue'

const version = __APP_VERSION__
const build = __APP_BUILD__ || 'dev'

const rows = computed(() => [
  { label: t('about.row.version'), value: version },
  { label: t('about.row.build'), value: build },
  { label: t('about.row.editor'), value: t('about.row.editor.value') },
  { label: t('about.row.framework'), value: t('about.row.framework.value') },
  { label: t('about.row.storage'), value: t('about.row.storage.value') },
  { label: t('about.row.usage'), value: st.quotaSize || '—' },
  { label: t('about.row.drafts'), value: t('about.row.drafts.value', { n: docs.value.length }) },
  {
    label: t('about.row.current'),
    value: t('about.row.current.value', {
      title: currentMeta.value?.title ?? t('doc.untitled'),
      chars: st.chars,
    }),
  },
  { label: t('about.row.encoding'), value: encodingLabel(currentMeta.value?.encoding) },
  { label: t('about.row.language'), value: localeLabel(locale.value) },
  { label: t('about.row.theme'), value: st.dark ? t('about.theme.dark') : t('about.theme.light') },
  { label: t('about.row.snapshot'), value: t('about.row.snapshot.value') },
])

function diagnostics(): string {
  return [
    `Litepad ${version} (build ${build})`,
    `locale: ${locale.value} · theme: ${st.dark ? 'dark' : 'light'}`,
    `drafts: ${docs.value.length} · current: ${currentMeta.value?.title ?? '-'} (${st.chars} chars)`,
    `origin usage: ${st.quotaSize || 'n/a'} · encoding: ${encodingLabel(currentMeta.value?.encoding)}`,
    `user agent: ${navigator.userAgent}`,
  ].join('\n')
}

async function copyDiagnostics(): Promise<void> {
  const text = diagnostics()
  try {
    await navigator.clipboard.writeText(text)
    showToast(t('about.copied'))
    return
  } catch {
    /* 回退到 execCommand */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    showToast(ok ? t('about.copied') : t('about.copyFailed'))
  } catch {
    showToast(t('about.copyFailed'))
  }
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && st.aboutOpen) closeAbout()
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Transition name="fade">
    <div
      v-if="st.aboutOpen"
      data-testid="about-modal"
      class="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]"
      @click.self="closeAbout()"
    >
      <Transition name="pop" appear>
        <div
          class="w-[22rem] max-w-full overflow-hidden rounded-2xl border border-black/10 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/95"
        >
          <!-- 图标 / 应用名 / 版本 -->
          <div class="flex flex-col items-center gap-1.5 px-6 pt-8 pb-5 text-center">
            <BrandLogo size="lg" />
            <h2 class="mt-1 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {{ t('app.title') }}
            </h2>
            <p class="text-[11px] text-zinc-500 dark:text-zinc-400">
              {{ t('about.version', { version }) }} · {{ t('about.build', { build }) }}
            </p>
          </div>

          <!-- 规格行（细分割线，macOS 风格） -->
          <div
            class="mx-4 mb-3 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-800/40"
          >
            <div
              v-for="(row, i) in rows"
              :key="row.label"
              class="flex items-baseline justify-between gap-3 px-3 py-1.5 text-[11px]"
              :class="i ? 'border-t border-zinc-200/70 dark:border-zinc-700/50' : ''"
            >
              <span class="shrink-0 text-zinc-500 dark:text-zinc-400">{{ row.label }}</span>
              <span class="truncate text-right font-medium text-zinc-700 dark:text-zinc-200">
                {{ row.value }}
              </span>
            </div>
          </div>

          <p class="pb-3 text-center text-[10px] text-zinc-400 dark:text-zinc-500">
            {{ t('about.footer') }}
          </p>

          <div class="flex items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <button data-testid="about-copy" class="btn" @click="copyDiagnostics()">
              {{ t('about.copy') }}
            </button>
            <button data-testid="about-close" class="btn" @click="closeAbout()">
              {{ t('about.close') }}
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
