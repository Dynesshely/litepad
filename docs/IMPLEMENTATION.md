# 实现笔记

记录「为什么这么实现」以及踩过的坑。用户向说明见 [`README.md`](../README.md)，
环境/测试/提交约定见 [`DEVELOPMENT.md`](./DEVELOPMENT.md)。

## 壁纸（背景图片）

- 图片以 Blob 写入 **IndexedDB**（库 `litepad-assets` / store `assets` / 键 `appearance.background`）：
  localStorage 按 UTF-16 计费且只有约 5MB，不适合放图片；只有「可见度/模糊度」这类小偏好留在 localStorage；
- 读取时用 `URL.createObjectURL` 生成会话内 URL（不把 base64 存进 localStorage），替换或清除时 `revokeObjectURL`；
- 应用后给 `<html>` 加 `.has-bg`（与 `.dark` 同层），叠一层随主题变化的遮罩，
  **遮罩强度 = 100 − 可见度**，另有**模糊度 0–40px**（模糊时图层放大 1.06 倍，避免边缘发虚）；
- **表面色统一由 CSS 变量驱动**（`--surface` / `--surface-2` / `--editor-bg`）：
  `html.has-bg` 把面板切为半透明、把 `--editor-bg` 设为 `transparent`（Monaco 另有显式透明规则），
  深色由 `html.dark` 决定，因此壁纸下顶栏/状态栏/按钮/选中草稿/编辑区都会透出壁纸，且深色主题仍是深色面板；
- **根容器背景同样必须透明**（`--app-bg`，`html.has-bg` 时置为 `transparent`）：
  壁纸层是 `position: fixed; z-index: -10`，任何**不透明祖先背景**都会把它整块盖住 ——
  曾经 `#app` 根 div 写死 `bg-zinc-50`，结果是壁纸在任何主题下都完全不可见，深色模式下还露出一层浅色底
  （表现为「深色模式显示的是一层亮色遮罩」）。另有 `--app-base` 挂在 `<html>` 上做兜底不透明底色，图片加载前不闪白；
- **首屏不闪不透明底色**：图片本体在 IndexedDB 里只能异步读回，因此「是否已设置壁纸」额外用同步的
  `hasBg` 标记存进 `dsh.scratch.v1.ui`，`index.html` 的防闪烁脚本与 store 初始化都会据此先加上 `has-bg`；
  标记为真但 IndexedDB 里图片已不存在时，初始化会回收该标记，避免一直用半透明表面；
- **编辑区保留底色**（`editor-tint`，**默认关**）：壁纸花的时候正文直接压在照片上不好读，
  打开后编辑区垫一层淡底色（深色 `rgb(9 9 11 / 0.25)`、浅色白 `0.35`），照片仍透出来；
  没有壁纸时该开关禁用（此时编辑区本来就用主题色）；
- 限制：仅图片类型、上限 8MB；IndexedDB 不可用（如部分隐私模式）时会明确提示而不是静默失败。

### 教训：断言要断言「画出来的东西」

这个 bug 第一次修复时方向错了：当时只断言了 `--surface` / `--editor-bg` 这些变量值，变量全对、
测试全绿，但屏幕上是错的。真正的验证方式是从截图里取像素（`feature6-test.cjs` 里自写了 PNG 解码），
并额外断言「编辑区到 `<html>` 之间不存在任何不透明背景」。

## 代码着色

- **只注册 editor worker**：语法着色走 Monarch 词法，不需要语言服务 worker。Monaco 默认为
  json / css / html / typescript 注册语言服务 provider，一旦被触发（hover、补全、诊断、inlay hints）
  就会把协议消息发到 editor worker 上，抛出 `Missing requestHandler or method: getSyntacticDiagnostics`
  这类未捕获错误 —— 因此启动时显式把这些语言服务的 modeConfiguration 全部关掉（0.56 起这些 defaults
  从 `monaco.languages.*` 移到了顶层导出）。Litepad 刻意不做补全/诊断那套 IDE 能力，要那些请用 VSCode；
- **自动检测宁可不猜**：只看正文前 20000 字符，按 JSON / XML / HTML / PHP / shebang / Dockerfile / YAML /
  SQL / Go / Rust / Java / C / C++ / C# / Python / TypeScript / JavaScript / Ruby / Markdown / CSS 顺序找特征，
  信号不足就回退纯文本（猜错着色比不着色更让人困惑）。输入停止 500ms 后重算，且只有结果真的变了才
  `setModelLanguage`（否则每次按键都会清空 token 缓存、屏幕闪一下）；
- **语言按草稿独立保存**（元数据 `lang`，`auto` 表示自动检测）；
- 语言显示名取自 Monaco 注册表（`langRegistry.ts`），只有 `plaintext` 走界面语言文案
  （Monaco 的别名固定是英文 "Plain Text"）。

### 教训：测试内容要用剪贴板粘贴

用 `keyboard.insertText` 逐字写入一条多行 JSON 时，Monaco 会自动补全括号/引号，粘出来的文本并不合法，
于是「自动检测识别 JSON」这条测试失败，而真实使用（粘贴）完全正常。测试改成用剪贴板 `Ctrl+V`，
并额外断言「粘贴后行数与预期一致」。

## 命令面板与 scope 语义

- 作用范围由 `scope` 决定：`auto` = 有选区就作用于选区、否则全文；`lines` = **有选区就作用于选区覆盖的整行，
  无选区则作用于整篇**（对齐 VSCode）；`whole` = 始终全文。
  `lines` 这条语义是关键：否则「删除空行 / 行排序 / 行去重」在只看光标时会变成单行操作，表现为「点了没反应」；
- 所有行类变换先把 `\r\n` 与孤立 `\r` 归一化，并按原文档换行风格回写 —— 否则 CRLF 文档做「多行转单行」时，
  每行残留的 `\r` 会让连接符跑到行首；
- 替换统一走 Monaco 的 `executeEdits`，因此**一条命令只占一步撤销**，且执行后照常自动落盘；
- 新增一条命令：在 `src/lib/commands.ts` 的 `COMMANDS` 里加一项（`kind: 'transform' | 'info' | 'action'`，
  配 `scope` 与纯函数 `transform`），再到 `src/lib/i18n.ts` 补标题键；纯函数放在 `src/lib/textOps.ts`，可独立测试。

## 文本编码

- 编码只在**字节边界**上有意义：编辑器内部与 localStorage 中始终是 JS 字符串，**切换编码不会改动正文**；
- 浏览器只提供**解码**传统编码的 API，因此编码方向由 `TextDecoder(label, { fatal: true })` 反向枚举
  合法字节序列、按需生成 char → bytes 映射表并缓存（首次使用某编码时有一次性开销）；
- 目标编码无法表示的字符会写成 `?`，导出时状态栏提示会给出数量；
- 导入 .txt 时**优先识别 BOM**（UTF-8/UTF-16），无 BOM 才用草稿当前编码解读；
- 编码**按草稿独立保存**（元数据 `encoding` 字段）。

## 自动保存、历史与配额

- 输入停止 400ms 后落盘；`visibilitychange` / `pagehide` / `beforeunload` 强制 flush；
- `doc` / `doc.bak` 双键轮换：写主键前先把当前值转存到备份键，「回退一步」即从备份恢复；
- 历史快照每 20 秒最多一份，每篇最多 40 份、合计不超过 60 万字符，超出按时间淘汰；
- 配额写满时自动降级到 sessionStorage 并红色横幅警示，状态栏实时显示占用；
- 备份：一键导出全部草稿为 JSON（含编码/语言设置），导入时按草稿合并、新版本优先。

## 草稿列表排序

- 顺序存在元数据 `order` 字段（越小越靠前）；**新草稿总是插到列表最前**（取当前最小值 − 1）；
- 老数据（没有 `order`）首次启动时按「最近更新优先」补一份初始顺序，之后才跟随手动顺序；
- 「⇅ 最近更新」按钮即放弃手动顺序、按 `updatedAt` 重排并写回 `order`。

## 与旧原型的兼容

存储键契约与最初的零依赖单文件原型（`legacy/scratch.html`）**完全一致**，因此从原型换到本工程后，
已有草稿会自动继承，不需要任何迁移步骤；文件名/目录改名同样不影响（键前缀刻意不动）。

## i18n

- 轻量实现：`src/lib/i18n.ts` 里的 `LOCALES` + `messages` 词典、`{name}` 插值、`locale` ref；
- 状态栏的保存文案存的是 `saveKey + 时间戳`（而不是当时翻译好的整句），
  因此**切换语言的瞬间**已经显示的「已自动保存 12:03:05」也会跟着翻译；
- 新增语言：在两处词典各加一项即可，缺失的 key 回退 zh-CN 并在开发模式控制台告警。

## 「关于」面板

- 版式为 macOS 关于页：顶部居中 64px 大图标（与 favicon 同源）→ 应用名 → 版本/构建号 → 细分割线规格行；
- 「复制诊断信息」写出：版本/构建号、语言与主题、草稿数量与当前草稿字符数、本页占用、User-Agent；
  剪贴板 API 不可用时回退到 `execCommand`，避免在非安全上下文里静默失败。

## Monaco 集成

- 每篇草稿**独立 model / undo 栈**：切换草稿时按 `key` 整块重挂载编辑器组件；
- 编辑器与 store 之间通过 `EditorSink` 桥接（读文本/单步替换/选中范围/跳转/聚焦），
  命令实现因此不依赖编辑器实例；
- 版本号与构建号由 `vite.config.ts` 的 `define` 在构建期注入：`__APP_VERSION__` 取 `package.json`，
  `__APP_BUILD__` 取 `git rev-parse --short HEAD`（非 git 环境回退 `dev`）。
  **改版本号后开发服务器要重启**，否则页面里还是旧值。

## 底栏排版

- 底栏 `line-height` 固定 16.5px，此时基线在行盒内的位置由字体自身的 ascent/descent 决定
  （`(line-height − (A+D)) / 2 + A`）。编码按钮曾经单独用 `font-mono`，等宽字体的度量与界面字体不同，
  整行文字比邻居高约 1px；现在底栏统一字体，并加了「同一 font-family + 行盒顶底一致」的断言
  （`feature8-test.cjs`）—— 把 `font-mono` 加回去那条断言立刻失败，可作为灵敏度参考。
