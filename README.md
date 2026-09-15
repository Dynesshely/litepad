# Litepad

> 原项目名 `scratch-vue`，现更名 **Litepad**（目录同步为 `litepad/`）。存储键命名空间仍保留 `dsh.scratch.v1`，以免旧草稿丢失。

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
- 点工具栏品牌区打开**「关于 Litepad」**面板（模仿新版 macOS 关于页面），可查看版本/构建号与运行信息、一键复制诊断信息；
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

## 开发服务器启停（DevHub）

本项目遵循全局 DevHub 规则（全文见 `~/.devhub/README.md`）：**长驻开发服务器一律通过 `devctl` 启停**，
禁止 `pkill` / `killall` / 裸 `nohup … &` / 会话后台任务等方式——按名字杀进程无法区分归属，会误伤其他会话的服务。

```bash
~/.devhub/devctl status litepad --json            # 查登记表与运行态
~/.devhub/devctl start  litepad dev --wait-ready  # 启动（登记命令：dev / build）
~/.devhub/devctl stop   litepad dev               # 停止
~/.devhub/devctl restart litepad dev              # 重启
~/.devhub/devctl logs   litepad dev --tail 50     # 查看日志
```

登记信息：`dev = npm run dev -- --port ${PORT} --strictPort --host 0.0.0.0`，端口 `18080`（`npm` 需要 `--`
分隔符，否则 `--port/--strictPort/--host` 会被 npm 自身吞掉），`singleton: true`。

> **AI 会话注意**：`devctl` 需要写入 `~/.devhub/state/**`，该路径位于会话工作区之外（文件沙箱只读），
> 因此 AI **无法自行执行** `claim` / `start` / `stop`；这种情况应**停下来请在终端执行**，
> 不得改用 `pkill` / `nohup` / `run_in_background` 变通。

## 目录结构

```
litepad/
├── index.html              # 入口（防主题闪烁脚本 + 站点图标/清单声明）
├── vite.config.ts
├── public/                 # 站点图标：favicon.ico / favicon-32.png / apple-touch-icon.png / site.webmanifest（favicon.svg 单一来源在 src/assets，由 Vite 插件在 dev 提供并输出到产物）
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
        ├── BrandLogo.vue     # 页内 LOGO（?raw 内联 src/assets/favicon.svg）
        ├── AboutModal.vue    # 「关于 Litepad」面板（macOS 版式 + 复制诊断信息）
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

- 入口：工具栏品牌区（Logo + Litepad 文字）即按钮，`title` 为「关于 Litepad」；面板内可 `Esc`、点遮罩或「关闭」退出；
- 版式：顶部居中 64px 大图标（与 favicon 同源）→ 应用名 → `版本 x.y.z · 构建 <git 短哈希>`，中部为带细分割线的规格行（内核/框架/存储/占用/草稿数/当前草稿/语言/主题/快照策略），底部为操作按钮；
- 版本号与构建号由 `vite.config.ts` 的 `define` 在构建期注入（`__APP_VERSION__` 取自 `package.json`，`__APP_BUILD__` 取 `git rev-parse --short HEAD`，非 git 环境回退为 `dev`）；
- 「复制诊断信息」写出：版本/构建号、语言与主题、草稿数量与当前草稿字符数、本页占用、User-Agent；剪贴板不可用时回退到 `execCommand`。

## 设置弹窗

顶栏右侧「设置」按钮（或 `Ctrl/⌘+,`、命令菜单「打开设置」）打开设置弹窗，版式为
**上部整宽顶栏（搜索框）+ 下部左侧分页 / 右侧内容**。

- **搜索跳转**：顶栏搜索框索引全部设置项（标题 / id / 关键词，中英双语），命中后回车或点击即切换分页、
  把对应设置行滚动进可视区并短暂高亮（`↑↓` 选择 · `Enter` 跳转 · `Esc` 关闭）；
- **外观**：主题（浅色 / 深色）、界面语言、**背景图片**、图片可见度、背景模糊度；
- **数据**：导入备份、备份全部（原先在顶栏，已迁入此页）、存储占用、草稿数量。

### 背景图片（存 IndexedDB）

- 图片以 Blob 写入 **IndexedDB**（库 `litepad-assets` / store `assets` / 键 `appearance.background`）——
  localStorage 按 UTF-16 计费且只有约 5MB，不适合放图片；只有「可见度」这类小偏好留在 localStorage；
- 读取时用 `URL.createObjectURL` 生成会话内 URL（不把 base64 存进 localStorage），替换或清除时 `revokeObjectURL`；
- 应用后给 `<html>` 加 `.has-bg`（与 `.dark` 同层），叠一层随主题变化的遮罩，
  **遮罩强度 = 100 − 可见度**（数值越低正文越清晰），另有**模糊度 0–40px**（模糊时图层放大 1.06 倍，避免边缘发虚）；
- **表面色统一由 CSS 变量驱动**（`--surface` / `--surface-2` / `--editor-bg`）：
  `html.has-bg` 把面板切为半透明、把 `--editor-bg` 设为 `transparent`（Monaco 另有显式透明规则），
  深色由 `html.dark` 决定 —— 因此壁纸下顶栏/状态栏/按钮/选中草稿/编辑区都会透出壁纸，且深色主题仍是深色面板；
- **根容器背景同样必须透明**（`--app-bg`，`html.has-bg` 时置为 `transparent`）：
  壁纸层是 `position: fixed; z-index: -10`，任何不透明祖先背景都会把它整块盖住——
  之前 `#app` 根 div 写死 `bg-zinc-50`，于是壁纸在任何主题下都完全不可见，深色模式还会露出一层浅色底。
  另有 `--app-base` 挂在 `<html>` 上做兜底不透明底色（图片加载前不闪白）；
- **首屏不闪不透明底色**：图片本体在 IndexedDB 里只能异步读回，因此「是否已设置壁纸」额外用同步的
  `hasBg` 标记存进 `dsh.scratch.v1.ui`，`index.html` 的防闪烁脚本与 store 初始化都会据此先加上 `has-bg`；
- 限制：仅图片类型、上限 8MB；IndexedDB 不可用（如部分隐私模式）时会明确提示而不是静默失败。

## 图标（Lucide）

界面图标统一使用 **[Lucide](https://lucide.dev)**（`@lucide/vue`，**ISC 许可**，免费开源，3600+ 图标），
不再使用 emoji —— emoji 在不同系统/字体下字形与尺寸不一致，也无法随深浅色主题变色：

- 图标以 Vue 组件按需引入（tree-shaking，只打包用到的那些），尺寸用 Tailwind 类控制（工具栏 `h-3.5 w-3.5`）；
- 一律 `aria-hidden="true"`，可访问名称由按钮的 `title` / `aria-label` 提供；
- 单色图标继承 `currentColor`，因此深色模式、悬停态自动跟随；
- i18n 文案里**不再带 emoji 前缀**（例如「📄 草稿列表」→「草稿列表」），图标由模板负责。

> 依赖安装提示：本机 `HTTP(S)_PROXY` 指向的代理若不可达，可临时绕过：
> `env -u HTTP_PROXY -u HTTPS_PROXY npm install <pkg>`。

## 命令菜单（命令面板）

仿 VSCode 的命令面板：**Ctrl/⌘+Shift+P** 或 **F1** 唤起（编辑器聚焦、焦点在别处均可），工具栏也有「⌨ 命令菜单」入口。
支持模糊搜索（标题 / id / 关键词）、↑↓ 选择、Enter 执行、Esc 关闭。

命令的作用范围由 `scope` 决定：
`auto` = 有选区就作用于选区、否则全文；`lines` = **有选区就作用于选区覆盖的整行，无选区则作用于整篇**（对齐 VSCode，
否则「删除空行 / 行排序 / 行去重」在只看光标时会变成单行操作，表现为「点了没反应」）；`whole` = 始终全文。
所有行类变换都会先把 `\r\n` 与孤立 `\r` 归一化，并按原文档换行风格回写。
替换统一走 Monaco 的 `executeEdits`，因此**一条命令只占一步撤销**（一次 Ctrl+Z 回退），且执行后照常自动落盘。

| 分组 | 命令 |
| --- | --- |
| 行操作 | 多行转单行（弹框输入连接符，支持 `\n`）、单行转多行（**选区即分隔符**）、整篇按分隔符拆分、行排序（升序/降序，数字感知）、行去重、反转行序、删除空行、去除首尾空白、删除行尾空白、每行加行号、每行加双引号、切换行注释（`// `） |
| 大小写与命名 | 大写、小写、大小写互换、kebab-case、snake_case、camelCase |
| 编码与数据 | Base64 编码/解码（UTF-8 安全）、URL 编码/解码、JSON 美化/压缩、JSON 字符串转义/反转义 |
| 文本 | 反转字符顺序、每行加 Markdown 引用（`> `）、折叠连续空格 |
| 导航与信息 | 文本统计（选区或全文，信息弹框）、跳转到行 |

新增一条命令：在 `src/lib/commands.ts` 往 `COMMANDS` 加一项（`kind: 'transform' | 'info' | 'action'`，
配 `scope` 与纯函数 `transform`），再到 `src/lib/i18n.ts` 补标题键即可 —— 命令实现与编辑器交互解耦，
`src/lib/textOps.ts` 里的纯函数可独立测试。

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
  `dsh.scratch.v1.ui`（主题 + 列表固定 + 界面语言 + 壁纸可见度/模糊度/`hasBg` 标记）。
  键契约与旧版单文件原型（`legacy/scratch.html`）一致 —— 换到本工程后旧草稿自动继承。
- **触发时机**：输入停止 400ms 后落盘；`visibilitychange`/`pagehide`/`beforeunload` 强制 flush。
- **配额写满**：自动降级到 sessionStorage 并红色横幅警示，状态栏实时显示占用空间。
- **备份**：工具栏可一键导出全部草稿为 JSON（含编码设置），之后可合并导入；单篇可按指定编码导出 .txt。

## legacy

`legacy/scratch.html` 为最初的零依赖单文件原型（同一套存储契约），可随时对照或删除。
