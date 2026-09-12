# Lightpad

> 原项目名 `scratch-vue`，现更名 **Lightpad**（目录同步为 `lightpad/`）。存储键命名空间仍保留 `dsh.scratch.v1`，以免旧草稿丢失。

纯本地、零后端、自动保存的临时文本编辑器。**每个草稿都只存在于你自己浏览器的 `localStorage`**，
无需 Ctrl+S、不弹任何保存对话框；数据落盘策略详见下文。

技术栈：Vue 3 + TypeScript + Vite + Tailwind CSS v4 + Monaco Editor（VS Code 同款编辑器内核）。

## 为什么用它而不是 Sublime 的另一个实例

- 想要“第二块草稿纸”时，**新开一个浏览器标签**即可 —— 每个标签自动对应一篇独立草稿；
- 内容随输入自动保存（防抖 400ms），关闭标签/刷新/断电重启都不丢；
- 误删不怕：`doc`/`doc.bak` 双键轮换 + 每 20 秒一份历史快照（每篇最多 40 份），可随时“回退一步”或从快照恢复；
- 草稿列表可在浮层抽屉与**左侧全高常驻面板**之间切换（状态持久化），并支持**拖动排序**（含「最近更新」一键重排）；
- 每篇草稿可单独指定**文本编码**（UTF-8/UTF-16 全家族 + GBK/Big5/Shift_JIS 等），决定 .txt 导入导出的字节；
- **中英双语界面**，语言默认跟随浏览器、可随时在工具栏切换（主题按钮左侧）并持久化；
- 页内 LOGO 与浏览器标签页图标（favicon）**共用同一份 SVG 源码**；
- 点工具栏品牌区打开**「关于 Lightpad」**面板（模仿新版 macOS 关于页面），可查看版本/构建号与运行信息、一键复制诊断信息；
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
lightpad/
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
    │   ├── format.ts       # 时间/标题等格式化（走 i18n）
    │   ├── encoding.ts     # 文本编码：UTF 家族编码 + 传统编码反向映射表
    │   ├── i18n.ts         # 轻量 i18n：zh-CN / en-US 词典、{name} 插值、locale ref
    │   └── download.ts     # Blob / 字节下载
    └── components/
        ├── MonacoEditor.vue  # Monaco 封装（每篇草稿独立 model / undo 栈）
        ├── Toolbar.vue
        ├── BrandLogo.vue     # 页内 LOGO（?raw 内联 public/favicon.svg）
        ├── AboutModal.vue    # 「关于 Lightpad」面板（macOS 版式 + 复制诊断信息）
        ├── LocaleMenu.vue    # 语言切换菜单
        ├── StatusBar.vue     # 保存状态 · 编码 · 占用 · 字符统计
        ├── DocList.vue       # 草稿列表（抽屉/固定面板共用，含拖动排序）
        ├── DocDrawer.vue     # 浮层抽屉外壳
        ├── EncodingMenu.vue  # 编码选择菜单（含按编码导入 .txt）
        ├── HistoryModal.vue  # 历史快照弹层
        ├── BannerHost.vue    # 状态横幅
        └── ToastHost.vue     # 轻提示
```

## 关于面板与版本注入

- 入口：工具栏品牌区（Logo + Lightpad 文字）即按钮，`title` 为「关于 Lightpad」；面板内可 `Esc`、点遮罩或「关闭」退出；
- 版式：顶部居中 64px 大图标（与 favicon 同源）→ 应用名 → `版本 x.y.z · 构建 <git 短哈希>`，中部为带细分割线的规格行（内核/框架/存储/占用/草稿数/当前草稿/语言/主题/快照策略），底部为操作按钮；
- 版本号与构建号由 `vite.config.ts` 的 `define` 在构建期注入（`__APP_VERSION__` 取自 `package.json`，`__APP_BUILD__` 取 `git rev-parse --short HEAD`，非 git 环境回退为 `dev`）；
- 「复制诊断信息」写出：版本/构建号、语言与主题、草稿数量与当前草稿字符数、本页占用、User-Agent；剪贴板不可用时回退到 `execCommand`。

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

## 界面语言（i18n）

- 内置 **简体中文 / English** 两套文案，入口在工具栏**主题按钮左侧**（🌐），切换后立即生效并持久化；
- 首次访问时语言跟随浏览器（`navigator.language` 以 `zh` 开头 → 中文，否则英文）；
- 状态栏的保存文案存储为 `saveKey + 时间戳`，因此**切换语言的瞬间**已显示的"已自动保存 12:03:05"也会跟着翻译；
- 新增语言：在 `src/lib/i18n.ts` 的 `LOCALES` 与 `messages` 里各加一项即可（缺失的 key 会回退到 zh-CN，开发模式下控制台会告警）。

## 草稿列表排序

- 列表默认按**手动顺序**（元数据 `order` 字段）排列，**拖动行即可调整**：位移超过 4px 才算拖动（因此点击切换草稿不受影响），拖动结束后紧接着的 click 会被抑制一次；
- 新草稿总是插到列表**最前**（`order` 取当前最小值 - 1）；
- 老数据（没有 `order`）首次启动时按"最近更新优先"补一份初始顺序；
- 点列表里的「⇅ 最近更新」可放弃手动顺序，重新按修改时间排序。

## 数据与自动保存机制

- **存储键**：`dsh.scratch.v1.index`（草稿元数据，含 `encoding` 与 `order`）、`dsh.scratch.v1.doc.<id>`（正文）、
  `dsh.scratch.v1.doc.<id>.bak`（上一次保存的备份）、`dsh.scratch.v1.doc.<id>.hist`（历史快照）、
  `dsh.scratch.v1.ui`（主题 + 列表固定 + 界面语言偏好）。
  键契约与旧版单文件原型（`legacy/scratch.html`）一致 —— 换到本工程后旧草稿自动继承。
- **触发时机**：输入停止 400ms 后落盘；`visibilitychange`/`pagehide`/`beforeunload` 强制 flush。
- **配额写满**：自动降级到 sessionStorage 并红色横幅警示，状态栏实时显示占用空间。
- **备份**：工具栏可一键导出全部草稿为 JSON（含编码设置），之后可合并导入；单篇可按指定编码导出 .txt。

## legacy

`legacy/scratch.html` 为最初的零依赖单文件原型（同一套存储契约），可随时对照或删除。
