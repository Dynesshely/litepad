<script setup lang="ts">
import { reactive } from 'vue'
import {
  closeSidebar,
  createNewDoc,
  deleteDoc,
  docs,
  pinSidebar,
  reorderDocs,
  sortDocsByRecent,
  st,
  switchToDoc,
  unpinSidebar,
} from '../store'
import { fmtRel } from '../lib/format'
import { encodingLabel } from '../lib/encoding'
import { t } from '../lib/i18n'
import { ArrowUpDown, GripVertical, Pin, PinOff, Plus, Trash2, X } from '@lucide/vue'

const props = defineProps<{ mode: 'docked' | 'overlay' }>()

function onNew(): void {
  createNewDoc()
  if (props.mode === 'overlay') closeSidebar()
}

/* ---------------- 拖动排序 ---------------- */
const DRAG_THRESHOLD = 4 // 位移超过 4px 才算拖动，否则视为点击切换

const drag = reactive({ id: '', from: -1, over: -1, active: false })
let startY = 0
let rowMids: number[] = []
let suppressClick = false

function collectRowMids(listEl: HTMLElement): void {
  rowMids = Array.from(listEl.querySelectorAll<HTMLElement>('li[data-doc-id]')).map((el) => {
    const rect = el.getBoundingClientRect()
    return (rect.top + rect.bottom) / 2
  })
}

function onRowPointerDown(e: PointerEvent, id: string, index: number): void {
  if (e.button !== 0) return
  if ((e.target as HTMLElement).closest('button')) return // 删除等按钮不触发拖动
  const row = e.currentTarget as HTMLElement
  const listEl = row.parentElement
  if (!listEl) return
  drag.id = id
  drag.from = index
  drag.over = index
  drag.active = false
  startY = e.clientY
  rowMids = []
  collectRowMids(listEl)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp, { once: true })
  window.addEventListener('pointercancel', onPointerUp, { once: true })
}

function onPointerMove(e: PointerEvent): void {
  if (!drag.id) return
  if (!drag.active) {
    if (Math.abs(e.clientY - startY) < DRAG_THRESHOLD) return
    drag.active = true
  }
  let target = rowMids.findIndex((mid) => e.clientY < mid)
  if (target === -1) target = rowMids.length - 1
  drag.over = target
}

function onPointerUp(): void {
  window.removeEventListener('pointermove', onPointerMove)
  if (drag.active && drag.id && drag.over !== drag.from) {
    reorderDocs(drag.id, drag.over)
  }
  if (drag.active) suppressClick = true // 拖动结束时抑制紧随其后的 click
  drag.id = ''
  drag.from = -1
  drag.over = -1
  drag.active = false
}

function onRowClick(id: string): void {
  if (suppressClick) {
    suppressClick = false
    return
  }
  switchToDoc(id)
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div
      class="flex items-center justify-between border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-800"
    >
      <span class="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{{ t('list.title') }}</span>
      <span class="flex items-center gap-1">
        <button
          data-testid="new-doc"
          class="btn btn-icon"
          :title="t('tb.newTitle')"
          :aria-label="t('list.newAria')"
          @click="onNew()"
        >
          <Plus class="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          data-testid="sort-recent"
          class="btn"
          :title="t('list.sortRecentTitle')"
          @click="sortDocsByRecent()"
        >
          <ArrowUpDown class="h-3.5 w-3.5" aria-hidden="true" />
          {{ t('list.sortRecent') }}
        </button>
        <button
          v-if="mode === 'overlay'"
          data-testid="pin-btn"
          class="btn btn-icon"
          :title="t('list.pinTitle')"
          :aria-label="t('list.pinAria')"
          @click="pinSidebar()"
        >
          <Pin class="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          v-else
          data-testid="unpin-btn"
          class="btn btn-icon border-indigo-400 bg-indigo-50 text-indigo-600 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-300"
          :title="t('list.unpinTitle')"
          :aria-label="t('list.unpinAria')"
          @click="unpinSidebar()"
        >
          <PinOff class="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          v-if="mode === 'overlay'"
          class="btn btn-icon"
          :title="t('list.closeTitle')"
          @click="closeSidebar()"
        >
          <X class="h-4 w-4" aria-hidden="true" />
        </button>
      </span>
    </div>

    <ul class="flex-1 overflow-y-auto p-1.5">
      <li v-if="!docs.length" class="px-3 py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
        {{ t('list.empty') }}
      </li>

      <li
        v-for="(d, index) in docs"
        :key="d.id"
        :data-doc-id="d.id"
        :data-index="index"
        data-testid="doc-row"
        class="group mb-0.5 flex cursor-pointer touch-pan-y items-center gap-2 rounded-lg px-2 py-1.5 transition-colors select-none hover:bg-[var(--surface-2)]"
        :class="[ d.id === st.currentId ? 'bg-[var(--surface-2)]' : '', drag.active && drag.id === d.id ? 'opacity-40' : '', drag.active && drag.over === index && drag.id !== d.id ? 'ring-2 ring-indigo-400 dark:ring-indigo-500' : '', ]"
        @pointerdown="onRowPointerDown($event, d.id, index)"
        @click="onRowClick(d.id)"
      >
        <span
          class="h-5 w-0.5 shrink-0 rounded-full transition-colors"
          :class="d.id === st.currentId ? 'bg-indigo-500' : 'bg-transparent'"
        ></span>
        <span
          class="shrink-0 cursor-grab text-[11px] text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-600"
          :title="t('list.dragTitle')"
        >
          <GripVertical class="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span class="min-w-0 flex-1">
          <span
            data-testid="doc-title"
            class="block truncate text-xs font-medium text-zinc-700 dark:text-zinc-200"
            :class="d.id === st.currentId ? 'text-indigo-600 dark:text-indigo-300' : ''"
          >
            {{ d.title }}
          </span>
          <span class="block text-[10px] text-zinc-400 dark:text-zinc-500">
            <span class="font-mono">{{ encodingLabel(d.encoding) }}</span>
            · {{ fmtRel(d.updatedAt) }}
          </span>
        </span>
        <button
          class="shrink-0 rounded px-1 py-0.5 text-xs opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/60 dark:hover:text-red-400"
          :title="t('list.deleteTitle')"
          @click.stop="deleteDoc(d.id)"
        >
          <Trash2 class="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </li>
    </ul>

    <div
      class="border-t border-zinc-200 px-3 py-1.5 text-[10px] leading-4 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500"
    >
      <template v-if="mode === 'docked'">{{ t('list.footerDocked') }}</template>
      <template v-else>{{ t('list.footerOverlay') }}</template>
    </div>
  </div>
</template>
