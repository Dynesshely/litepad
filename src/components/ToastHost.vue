<script setup lang="ts">
import { st } from '../store'
</script>

<template>
  <Transition name="toast">
    <div
      v-if="st.toast"
      :key="st.toast.seq"
      class="pointer-events-none fixed right-4 bottom-4 z-[70] max-w-[60vw] rounded-lg bg-zinc-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
    >
      {{ st.toast.msg }}
    </div>
  </Transition>
</template>
