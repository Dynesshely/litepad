<script setup lang="ts">
import { computed } from 'vue'
import { init, st } from './store'
import MonacoEditor from './components/MonacoEditor.vue'
import Toolbar from './components/Toolbar.vue'
import StatusBar from './components/StatusBar.vue'
import DocDrawer from './components/DocDrawer.vue'
import DocList from './components/DocList.vue'
import HistoryModal from './components/HistoryModal.vue'
import AboutModal from './components/AboutModal.vue'
import CommandPalette from './components/CommandPalette.vue'
import SettingsModal from './components/SettingsModal.vue'
import PromptDialog from './components/PromptDialog.vue'
import BannerHost from './components/BannerHost.vue'
import ToastHost from './components/ToastHost.vue'

// init 在 setup 阶段执行：先于子组件挂载，保证 Monaco 挂载时文档已就绪
init()

/** 背景图上方的遮罩：可见度越低遮罩越强，保证正文可读 */
const scrim = computed(() => {
  const alpha = Math.max(0, Math.min(1, 1 - st.appearance.opacity / 100))
  return st.dark ? `rgba(9, 9, 11, ${alpha})` : `rgba(250, 250, 250, ${alpha})`
})
</script>

<template>
  <div
    class="flex h-screen flex-col overflow-hidden bg-zinc-50 text-zinc-900 dark:text-zinc-100"
  >
    <!-- 外观：背景图片（取自 IndexedDB，objectURL 仅当前会话有效） -->
    <div
      v-if="st.appearance.imageUrl"
      data-testid="bg-image"
      class="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center"
      :style="{
        backgroundImage: `url('${st.appearance.imageUrl}')`,
        filter: st.appearance.blur ? `blur(${st.appearance.blur}px)` : 'none',
        transform: st.appearance.blur ? 'scale(1.06)' : 'none',
      }"
    ></div>
    <div
      v-if="st.appearance.imageUrl"
      data-testid="bg-scrim"
      class="pointer-events-none fixed inset-0 -z-10"
      :style="{ backgroundColor: scrim }"
    ></div>
    <Toolbar />
    <BannerHost />

    <div class="flex min-h-0 flex-1">
      <!-- 固定模式：草稿列表作为左侧全高常驻面板（占满工具栏与状态栏之间的整块高度） -->
      <aside
        v-if="st.sidebarPinned"
        data-testid="doc-panel"
        class="flex w-72 shrink-0 flex-col border-r border-zinc-200 bg-[var(--surface)] dark:border-zinc-800"
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
    <AboutModal />
    <CommandPalette v-if="st.paletteOpen" />
    <SettingsModal />
    <PromptDialog />
    <ToastHost />
  </div>
</template>
