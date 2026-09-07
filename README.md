# 临时草稿本（scratch-vue）

纯本地、零后端、自动保存的临时文本编辑器。**每个草稿都只存在于你自己浏览器的 `localStorage`**，
无需 Ctrl+S、不弹任何保存对话框；数据落盘策略详见下文。

技术栈：Vue 3 + TypeScript + Vite + Tailwind CSS v4 + Monaco Editor（VS Code 同款编辑器内核）。

## 为什么用它而不是 Sublime 的另一个实例

- 想要“第二块草稿纸”时，**新开一个浏览器标签**即可 —— 每个标签自动对应一篇独立草稿；
- 内容随输入自动保存（防抖 400ms），关闭标签/刷新/断电重启都不丢；
- 误删不怕：`doc`/`doc.bak` 双键轮换 + 每 20 秒一份历史快照（每篇最多 40 份），可随时“回退一步”或从快照恢复；
- 无账号、无网络依赖、数据不经过任何服务器。

## 运行

```bash
npm install
npm run dev      # 开发模式  http://127.0.0.1:5173
npm run build    # 产物在 dist/
npm run preview  # 预览构建产物 http://127.0.0.1:4173
npm run typecheck
```

> 注意：务必通过 **http**（dev/preview，或任意静态服务器）访问，不要在 `file://` 下使用——
> 不同浏览器对 `file://` 页面 localStorage 的支持不一致（页面会提示并自检）。

## 目录结构

```
scratch-vue/
├── index.html              # 入口（含防主题闪烁脚本）
├── vite.config.ts
└── src/
    ├── main.ts             # 应用入口
    ├── App.vue             # 布局壳
    ├── style.css           # Tailwind 入口 + 全局样式/过渡
    ├── store.ts            # 全局状态与核心逻辑（单例，reactive）
    ├── lib/
    │   ├── storage.ts      # localStorage→sessionStorage→内存 降级读写
    │   ├── format.ts       # 时间/标题等格式化
    │   └── download.ts     # Blob 下载
    └── components/
        ├── MonacoEditor.vue  # Monaco 封装（每篇草稿独立 model / undo 栈）
        ├── Toolbar.vue
        ├── StatusBar.vue
        ├── DocDrawer.vue     # 草稿列表抽屉
        ├── HistoryModal.vue  # 历史快照弹层
        ├── BannerHost.vue    # 状态横幅
        └── ToastHost.vue     # 轻提示
```

## 数据与自动保存机制

- **存储键**：`dsh.scratch.v1.index`（草稿元数据）、`dsh.scratch.v1.doc.<id>`（正文）、
  `dsh.scratch.v1.doc.<id>.bak`（上一次保存的备份）、`dsh.scratch.v1.doc.<id>.hist`（历史快照）、
  `dsh.scratch.v1.ui`（主题偏好）。
  键契约与旧版单文件原型（`legacy/scratch.html`）一致 —— 换到本工程后旧草稿自动继承。
- **触发时机**：输入停止 400ms 后落盘；`visibilitychange`/`pagehide`/`beforeunload` 强制 flush。
- **配额写满**：自动降级到 sessionStorage 并红色横幅警示，状态栏实时显示占用空间。
- **备份**：工具栏可一键导出全部草稿为 JSON，之后可合并导入；单篇可导出 .txt。

## legacy

`legacy/scratch.html` 为最初的零依赖单文件原型（同一套存储契约），可随时对照或删除。
