<script setup lang="ts">
import { init, st } from './store'
import MonacoEditor from './components/MonacoEditor.vue'
import Toolbar from './components/Toolbar.vue'
import StatusBar from './components/StatusBar.vue'
import DocDrawer from './components/DocDrawer.vue'
import HistoryModal from './components/HistoryModal.vue'
import BannerHost from './components/BannerHost.vue'
import ToastHost from './components/ToastHost.vue'

// init 在 setup 阶段执行：先于子组件挂载，保证 Monaco 挂载时文档已就绪
init()
</script>

<template>
  <div
    class="flex h-screen flex-col overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"
  >
    <Toolbar />
    <BannerHost />
    <main class="relative min-h-0 flex-1">
      <!-- key=currentId：切换草稿时整块重挂载，每篇草稿拥有独立的 Monaco model / undo 栈 -->
      <MonacoEditor v-if="st.currentId" :key="st.currentId" />
    </main>
    <StatusBar />
    <DocDrawer />
    <HistoryModal />
    <ToastHost />
  </div>
</template>
