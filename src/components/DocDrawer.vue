<script setup lang="ts">
import { closeSidebar, st } from '../store'
import DocList from './DocList.vue'
</script>

<template>
  <Transition name="fade">
    <div
      v-if="st.sidebarOpen && !st.sidebarPinned"
      class="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
      @click="closeSidebar()"
    ></div>
  </Transition>

  <Transition name="slide">
    <aside
      v-if="st.sidebarOpen && !st.sidebarPinned"
      class="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-zinc-200 bg-[var(--surface)] shadow-2xl dark:border-zinc-800"
    >
      <DocList mode="overlay" />
    </aside>
  </Transition>
</template>
