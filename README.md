# 临时草稿本（scratch-vue）

纯本地、零后端、自动保存的临时文本编辑器。**每个草稿都只存在于你自己浏览器的 `localStorage`**，
无需 Ctrl+S、不弹任何保存对话框；数据落盘策略详见下文。

技术栈：Vue 3 + TypeScript + Vite + Tailwind CSS v4 + Monaco Editor（VS Code 同款编辑器内核）。

## 为什么用它而不是 Sublime 的另一个实例

- 想要“第二块草稿纸”时，**新开一个浏览器标签**即可 —— 每个标签自动对应一篇独立草稿；
- 内容随输入自动保存（防抖 400ms），关闭标签/刷新/断电重启都不丢；
- 误删不怕：`doc`/`doc.bak` 双键轮换 + 每 20 秒一份历史快照（每篇最多 40 份），可随时“回退一步”或从快照恢复；
- 草稿列表可在浮层抽屉与**左侧全高常驻面板**之间切换（状态持久化）；
- 每篇草稿可单独指定**文本编码**（UTF-8/UTF-16 全家族 + GBK/Big5/Shift_JIS 等），决定 .txt 导入导出的字节；
- 无账号、无网络依赖、数据不经过任何服务器。

## 运行

```bash
npm install
npm run dev      # 开发模式  http://0.0.0.0:18080
npm run build    # 产物在 dist/
npm run preview  # 预览构建产物 http://0.0.0.0:18080
npm run typecheck
```

> 注意：务必通过 **http**（dev/preview，或任意静态服务器）访问，不要在 `file://` 下使用——
> 不同浏览器对 `file://` 页面 localStorage 的支持不一致（页面会提示并自检）。

## 目录结构

```
scratch-vue/
├── index.html              # 入口（防主题闪烁脚本 + 站点图标/清单声明）
├── vite.config.ts
├── public/                 # 站点图标：favicon.svg / favicon.ico / favicon-32.png / apple-touch-icon.png / site.webmanifest
└── src/
    ├── main.ts             # 应用入口
    ├── App.vue             # 布局壳（含左侧固定面板的 flex 布局）
    ├── style.css           # Tailwind 入口 + 全局样式/过渡
    ├── store.ts            # 全局状态与核心逻辑（单例，reactive）
    ├── lib/
    │   ├── storage.ts      # localStorage→sessionStorage→内存 降级读写
    │   ├── format.ts       # 时间/标题等格式化
    │   ├── encoding.ts     # 文本编码：UTF 家族编码 + 传统编码反向映射表
    │   └── download.ts     # Blob / 字节下载
    └── components/
        ├── MonacoEditor.vue  # Monaco 封装（每篇草稿独立 model / undo 栈）
        ├── Toolbar.vue
        ├── StatusBar.vue     # 保存状态 · 编码 · 占用 · 字符统计
        ├── DocList.vue       # 草稿列表（抽屉与固定面板共用）
        ├── DocDrawer.vue     # 浮层抽屉外壳
        ├── EncodingMenu.vue  # 编码选择菜单（含按编码导入 .txt）
        ├── HistoryModal.vue  # 历史快照弹层
        ├── BannerHost.vue    # 状态横幅
        └── ToastHost.vue     # 轻提示
```

## 文本编码

编码只在**字节边界**上有意义：导出 .txt 时把字符串编成字节，导入 .txt 时把字节解回字符串；
编辑器内部与 localStorage 中始终是 JS 字符串，**切换编码不会改动正文**。

| 分组 | 编码 | 说明 |
| --- | --- | --- |
| Unicode | UTF-8、UTF-8 BOM、UTF-16 LE/BE（含 BOM 变体） | 原生编码，无损 |
| 中文 | GBK、GB18030、Big5 | GB18030 四字节生僻字不支持编码 |
| 日文/韩文/西欧 | Shift_JIS、EUC-KR、Windows-1252、ISO-8859-1 | 按需生成映射表 |

- 编码**按草稿独立保存**（元数据 `encoding` 字段），状态栏点击即可切换；
- 浏览器只提供**解码**传统编码的 API，因此编码方向由 `TextDecoder(fatal)` 反向枚举合法字节序列、
  按需生成 char → bytes 映射表并缓存（首次使用某编码时有一次性开销）；
- 目标编码无法表示的字符会写成 `?`，导出时状态栏提示会给出数量；
- 导入 .txt 时**优先识别 BOM**（UTF-8/UTF-16），无 BOM 才用草稿当前编码解读。

## 数据与自动保存机制

- **存储键**：`dsh.scratch.v1.index`（草稿元数据，含每篇的 `encoding`）、`dsh.scratch.v1.doc.<id>`（正文）、
  `dsh.scratch.v1.doc.<id>.bak`（上一次保存的备份）、`dsh.scratch.v1.doc.<id>.hist`（历史快照）、
  `dsh.scratch.v1.ui`（主题 + 列表固定偏好）。
  键契约与旧版单文件原型（`legacy/scratch.html`）一致 —— 换到本工程后旧草稿自动继承。
- **触发时机**：输入停止 400ms 后落盘；`visibilitychange`/`pagehide`/`beforeunload` 强制 flush。
- **配额写满**：自动降级到 sessionStorage 并红色横幅警示，状态栏实时显示占用空间。
- **备份**：工具栏可一键导出全部草稿为 JSON（含编码设置），之后可合并导入；单篇可按指定编码导出 .txt。

## legacy

`legacy/scratch.html` 为最初的零依赖单文件原型（同一套存储契约），可随时对照或删除。
