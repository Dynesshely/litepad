<script setup lang="ts">
/**
 * 命令菜单（仿 VSCode 的命令面板）：Ctrl/⌘+Shift+P 或 F1 唤起，
 * 支持模糊搜索、↑↓ 选择、Enter 执行、Esc 关闭。
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { COMMANDS, fuzzyScore, searchHaystack, type CommandDef } from '../lib/commands'
import { t } from '../lib/i18n'
import { closePalette, runCommandById } from '../store'

interface Row {
  def: CommandDef
  title: string
  group: string
  score: number
}

const query = ref('')
const active = ref(0)
const inputEl = ref<HTMLInputElement | null>(null)
const listEl = ref<HTMLDivElement | null>(null)

const rows = computed<Row[]>(() => {
  const q = query.value.trim()
  const out: Row[] = []
  COMMANDS.forEach((def, index) => {
    const score = q ? fuzzyScore(q, searchHaystack(def)) : 1
    if (score > 0) out.push({ def, title: t(def.titleKey), group: t(def.groupKey), score: score * 1000 - index })
  })
  return out.sort((a, b) => b.score - a.score)
})

watch(rows, () => {
  active.value = 0
  void nextTick(scrollActiveIntoView)
})

function scrollActiveIntoView(): void {
  listEl.value?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
}

function move(delta: number): void {
  if (!rows.value.length) return
  active.value = (active.value + delta + rows.value.length) % rows.value.length
  void nextTick(scrollActiveIntoView)
}

function run(index: number = active.value): void {
  const row = rows.value[index]
  if (!row) return
  closePalette()
  runCommandById(row.def.id)
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    move(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    move(-1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    run()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    closePalette()
  }
}

onMounted(() => {
  inputEl.value?.focus()
  void nextTick(scrollActiveIntoView)
})
</script>

<template>
  <Transition name="fade">
    <div
      class="fixed inset-0 z-[70] flex items-start justify-center bg-black/25 px-4 pt-[12vh] backdrop-blur-[1px]"
      @click.self="closePalette()"
    >
      <Transition name="pop" appear>
        <div
          data-testid="palette"
          class="w-[38rem] max-w-full overflow-hidden rounded-xl border border-black/10 bg-[var(--surface)] shadow-2xl dark:border-white/10"
        >
          <input
            ref="inputEl"
            v-model="query"
            data-testid="palette-input"
            :placeholder="t('cmd.placeholder')"
            class="w-full border-b border-zinc-200 bg-transparent px-4 py-2.5 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 dark:border-zinc-700 dark:text-zinc-100"
            @keydown="onKeydown"
          />

          <div ref="listEl" class="max-h-[46vh] overflow-y-auto py-1">
            <div v-if="!rows.length" class="px-4 py-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
              {{ t('cmd.empty') }}
            </div>
            <button
              v-for="(row, i) in rows"
              :key="row.def.id"
              :data-command="row.def.id"
              :data-active="i === active"
              class="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-1.5 text-left text-xs transition-colors"
              :class="i === active ? 'bg-indigo-500 text-white' : 'text-zinc-700 hover:bg-[var(--surface-2)] dark:text-zinc-200 '"
              @mousemove="active = i"
              @click="run(i)"
            >
              <span class="truncate">{{ row.title }}</span>
              <span
                class="shrink-0 text-[10px]"
                :class="i === active ? 'text-white/80' : 'text-zinc-400 dark:text-zinc-500'"
              >
                {{ row.group }}
              </span>
            </button>
          </div>

          <div
            class="border-t border-zinc-200 px-4 py-1.5 text-[10px] text-zinc-400 dark:border-zinc-700 dark:text-zinc-500"
          >
            {{ t('cmd.hint') }}
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
