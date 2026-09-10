<script setup lang="ts">
import { init, st } from './store'
import MonacoEditor from './components/MonacoEditor.vue'
import Toolbar from './components/Toolbar.vue'
import StatusBar from './components/StatusBar.vue'
import DocDrawer from './components/DocDrawer.vue'
import DocList from './components/DocList.vue'
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

    <div class="flex min-h-0 flex-1">
      <!-- 固定模式：草稿列表作为左侧全高常驻面板（占满工具栏与状态栏之间的整块高度） -->
      <aside
        v-if="st.sidebarPinned"
        data-testid="doc-panel"
        class="flex w-72 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      >
        <DocList mode="docked" />
      </aside>

      <!-- min-w-0：Monaco 会给容器写死像素宽度，若不加这项 flex 子项无法被压缩，
           固定面板就会盖住编辑区而不是把它挤窄 -->
      <main class="relative min-h-0 min-w-0 flex-1">
        <!-- key=currentId：切换草稿时整块重挂载，每篇草稿拥有独立的 Monaco model / undo 栈 -->
        <MonacoEditor v-if="st.currentId" :key="st.currentId" />
      </main>
    </div>

    <StatusBar />
    <DocDrawer />
    <HistoryModal />
    <ToastHost />
  </div>
</template>
