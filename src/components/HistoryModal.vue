<script setup lang="ts">
import { st, closeHistory, historyList, restoreSnapshot } from '../store'
import { fmtFull } from '../lib/format'
import { t } from '../lib/i18n'

const rows = historyList
</script>

<template>
  <Transition name="fade">
    <div
      v-if="st.historyOpen"
      class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-[1px]"
      @click.self="closeHistory()"
    >
      <div
        class="flex max-h-[78vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <header
          class="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800"
        >
          <span class="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{{ t('hist.title') }}</span>
          <button class="btn" @click="closeHistory()">{{ t('hist.close') }}</button>
        </header>

        <p class="border-b border-zinc-100 px-4 py-2 text-xs leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
          {{ t('hist.hint') }}
        </p>

        <ul v-if="rows.length" class="flex-1 overflow-y-auto p-2">
          <li
            v-for="s in [...rows].reverse()"
            :key="s.t"
            class="mb-0.5 flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <span class="min-w-[150px] font-mono text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
              {{ fmtFull(s.t) }}
            </span>
            <span class="flex-1 text-[11px] text-zinc-400 dark:text-zinc-500">
              {{ t('hist.chars', { n: s.c.length }) }}
            </span>
            <button class="btn" @click="restoreSnapshot(s.t)">{{ t('hist.restore') }}</button>
          </li>
        </ul>

        <div v-else class="px-4 py-10 text-center text-xs text-zinc-400 dark:text-zinc-500">
          {{ t('hist.empty') }}
        </div>
      </div>
    </div>
  </Transition>
</template>
