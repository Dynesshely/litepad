# 开发说明

面向维护者的文档。**用户向说明在根目录 [`README.md`](../README.md)**，实现层的取舍与踩坑记录见
[`IMPLEMENTATION.md`](./IMPLEMENTATION.md)。

## 项目缘起

最初只是想在用 Sublime Text 时能有「第二块随手丢的草稿纸」：Sublime 有自己的固定文件夹，
再开一个实例既要管文件、又要管保存，反而更麻烦。于是做了这个纯浏览器、免保存、关掉也还在的临时编辑器。

最早是零依赖单文件原型（`legacy/scratch.html`），后来重做成现在这套工程（Vue 3 + Vite + Monaco）。
项目曾名 `scratch-vue`，后更名 **Litepad**（目录同步为 `litepad/`）。

## 环境与命令

```bash
npm install
npm run dev        # 开发模式 http://0.0.0.0:18080（固定 5 位端口，strictPort）
npm run build      # 构建到 dist/
npm run preview    # 预览构建产物
npm run typecheck  # vue-tsc 类型检查
```

端口在 `vite.config.ts` 里固定为 `18080` 且监听 `0.0.0.0`；反代域名需加入
`server.allowedHosts`（Vite 对未知 Host 会返回 403）。

### 开发服务器启停（DevHub）

本项目遵循全局 DevHub 规则（全文见 `~/.devhub/README.md`）：**长驻开发服务器一律通过 `devctl` 启停**，
禁止 `pkill` / `killall` / 裸 `nohup … &` / 会话后台任务等方式 —— 按名字杀进程无法区分归属，会误伤其他会话的服务。

```bash
~/.devhub/devctl status litepad --json            # 查登记表与运行态
~/.devhub/devctl start  litepad dev --wait-ready  # 启动（登记命令：dev / build）
~/.devhub/devctl stop   litepad dev               # 停止
~/.devhub/devctl restart litepad dev              # 重启
~/.devhub/devctl logs   litepad dev --tail 50     # 查看日志
```

登记信息：`dev = npm run dev -- --port ${PORT} --strictPort --host 0.0.0.0`，端口 `18080`
（`npm` 需要 `--` 分隔符，否则 `--port/--strictPort/--host` 会被 npm 自身吞掉），`singleton: true`。

> **AI 会话注意**：`devctl` 需要写入 `~/.devhub/state/**`，该路径位于会话工作区之外（文件沙箱只读），
> 因此 AI **无法自行执行** `claim` / `start` / `stop`；这种情况应**停下来请在终端执行**，
> 不得改用 `pkill` / `nohup` / `run_in_background` 变通。
> 另外 `devctl restart` 会先 stop 再 start —— 若 start 因权限失败，服务会停在那儿，必须补一次授权后的重试。

### 依赖安装与代理

本机 `HTTP(S)_PROXY` 指向的代理若不可达，可临时绕过：

```bash
env -u HTTP_PROXY -u HTTPS_PROXY npm install <pkg>
```

## 目录结构

```
litepad/
├── index.html              # 入口（防主题/壁纸闪烁脚本 + 站点图标/清单声明）
├── vite.config.ts          # 端口/允许的 Host、favicon 插件、__APP_VERSION__ / __APP_BUILD__ 注入
├── public/                 # favicon.ico / favicon-32.png / apple-touch-icon.png / site.webmanifest
│                           #（favicon.svg 单一来源在 src/assets，由 Vite 插件在 dev 提供并输出到产物）
├── legacy/scratch.html     # 最初的零依赖单文件原型（同一套存储契约），可随时对照或删除
├── docs/                   # DEVELOPMENT.md（本文件） / IMPLEMENTATION.md（实现笔记）
│                           # images/：README 里展示用的截图（overview-dark.png，2x 分辨率）
└── src/
    ├── main.ts             # 应用入口
    ├── App.vue             # 布局壳（壁纸图层 + 左侧固定面板的 flex 布局 + 各弹层挂载点）
    ├── style.css           # Tailwind 入口 + 主题表面变量 + 全局样式/过渡
    ├── store.ts            # 全局状态与核心逻辑（单例 reactive，含自动保存/历史/命令执行）
    ├── assets/favicon.svg  # LOGO 与站点图标共用的唯一来源
    ├── lib/
    │   ├── storage.ts      # localStorage→sessionStorage→内存 降级读写
    │   ├── idb.ts          # IndexedDB 极简读写（背景图 Blob）
    │   ├── format.ts       # 时间/标题等格式化（走 i18n）
    │   ├── encoding.ts     # 文本编码：UTF 家族编码 + 传统编码反向映射表
    │   ├── textOps.ts      # 命令用的纯文本变换（可独立测试）
    │   ├── commands.ts     # 命令注册表（transform/info/action + scope）
    │   ├── languages.ts    # 常用语言清单 + 按内容自动检测（纯函数）
    │   ├── langRegistry.ts # Monaco 语言 id → 显示名
    │   ├── i18n.ts         # 轻量 i18n：zh-CN / en-US 词典、{name} 插值、locale ref
    │   └── download.ts     # Blob / 字节下载
    └── components/
        ├── MonacoEditor.vue    # Monaco 封装（每篇草稿独立 model / undo 栈）
        ├── Toolbar.vue         # 顶栏（新建/列表/翻页/命令菜单/导出/设置/语言/主题）
        ├── BrandLogo.vue       # 页内 LOGO（?raw 内联 src/assets/favicon.svg）
        ├── AboutModal.vue      # 「关于 Litepad」面板（macOS 版式 + 复制诊断信息）
        ├── SettingsModal.vue   # 设置弹窗（搜索顶栏 + 左侧分页/右侧内容）
        ├── CommandPalette.vue  # 命令面板
        ├── PromptDialog.vue    # 命令参数输入 / 信息弹框
        ├── LocaleMenu.vue      # 界面语言切换菜单
        ├── LanguageMenu.vue    # 代码语言（着色）选择菜单
        ├── EncodingMenu.vue    # 编码选择菜单（含按编码导入 .txt）
        ├── StatusBar.vue       # 保存状态 · 编码 · 语言 · 占用 · 字符统计
        ├── DocList.vue         # 草稿列表（抽屉/固定面板共用，含拖动排序）
        ├── DocDrawer.vue       # 浮层抽屉外壳
        ├── HistoryModal.vue    # 历史快照弹层
        ├── BannerHost.vue      # 状态横幅
        └── ToastHost.vue       # 轻提示
```

## 内部约定

### 存储键命名空间

键前缀固定为 `dsh.scratch.v1.*`，**刻意不跟着项目改名** —— 改名会让已有草稿读不到。
`dsh.` 前缀来自当初的工具目录命名，属于历史包袱，但数据兼容优先于命名整洁。

### README 用的图片

README 顶部的图标**直接引用 `src/assets/favicon.svg`**（页内 LOGO 与站点图标的唯一来源），
不要在 docs 下再放一份副本 —— 否则改图标要改两处。页面截图放在 `docs/images/`，
命名按「内容 + 主题」组织（如 `overview-dark.png`），以后补图沿用同一规律。

`../e2e/render-readme.cjs` 可以把 README 按近似 GitHub 的排版渲染成截图，
改完顶部装饰后可以跑一次肉眼确认（用 Playwright 的 route 把仓库文件当静态资源，
不需要额外起服务）。

### 底栏（状态栏）排版

底栏所有条目**必须使用同一种字体**，不要给某一项单独加 `font-mono`：底栏 `line-height` 固定 16.5px 时，
基线在行盒内的位置由字体自身的 ascent/descent 决定（`(line-height − (A+D)) / 2 + A`），
等宽字体与界面字体度量不同，会让那一项整体高约 1px。细节与断言见 `IMPLEMENTATION.md`。

### 提交约定

提交按**功能点**分门别类（一个功能点一个提交，附带该功能点的测试结论），并一律走 GPG 签名
（`commit.gpgsign` / `tag.gpgsign` 为 true；AI 的 shell 是非交互的，签名失败时应请人执行 `gpg-unlock`，
不要加 `--no-gpg-sign` 绕过）。

## 测试与验证

测试套件**不在本仓库内**，位于同级目录 `../e2e/`（Playwright + headless Chromium 驱动真实页面）。
它们是围绕本项目的黑盒/像素级回归，跟仓库一起分发意义不大，因此留在仓库外。

| 套件 | 条数 | 覆盖 |
| --- | --- | --- |
| `unit-textops` | 44 | 文本变换纯函数（在浏览器里 `import` 源码模块跑） |
| `feature-test` | 26 | 基础：自动保存、编码菜单、图标/清单、固定面板 |
| `feature2-test` | 29 | 草稿列表、拖动排序、抽屉 |
| `feature3-test` | 32 | 「关于」面板版式与复制诊断信息 |
| `feature4-test` | 43 | 命令面板与各条命令的行为 |
| `feature5-test` | 48 | 设置弹窗、搜索跳转、备份导入导出 |
| `feature6-test` | 42 | 壁纸：像素级验证壁纸可见性与主题底色 |
| `feature7-test` | 73 | 语法着色、语言菜单、自动检测样例 |
| `feature8-test` | 12 | 底栏排版（同字体/同行盒）与菜单 Esc 行为 |

共 349 条。跑法：`node ../e2e/feature7-test.cjs`（需要开发服务器已在 18080 运行）。

断言策略：**优先断言真实渲染结果** —— 截图取像素（自写 PNG 解码）、读 token 的 computed color、
量 Range 的实际行盒，而不是断言 class/变量存在。教训见 `IMPLEMENTATION.md` 的壁纸一节：
变量全对，屏幕上就是不对。

已知局限（写死在环境里，不是代码问题）：

- 容器内没有中文字体，CJK 会渲染成方框，因此「中文与拉丁文字是否对齐」这类对比不可用像素判断；
- 容器里的 DejaVu Sans / Sans Mono / Serif 共用一套纵向度量，**复现不出** macOS 上 SF Mono 与 SF Pro
  的基线差异 —— 这类平台相关差异只能靠「同一字体 + 同一行盒」这种与平台无关的结构断言守住；
- 测试里的版本号断言从 `package.json` 读；曾经写死过 `0.1.1`，升版本即误报。

## 已知问题 / 待办

- `devctl status` 偶尔报 `portListening: false, portPid: null`，而 `ss -ltn` 显示 `0.0.0.0:18080`
  正在监听、`curl` 也是 200 —— 疑似 devctl 在「监听者与 launcher 同组」这种启动方式下端口探测误报；
- 本仓库**尚无 LICENSE 文件**：真要开源发布前需要先定一个；
- `legacy/scratch.html` 是最初原型，保留只为对照，随时可删。
