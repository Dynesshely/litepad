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
├── .github/workflows/ci.yml # CI：main 推送/手动触发 → 类型检查、构建、发布 GitHub Pages
├── index.html              # 入口（防主题/壁纸闪烁脚本 + 站点图标/清单声明）
├── vite.config.ts          # 端口/允许的 Host、favicon 插件、__APP_VERSION__ / __APP_BUILD__ 注入
├── public/                 # favicon.ico / favicon-32.png / apple-touch-icon.png / site.webmanifest
│                           #（favicon.svg 单一来源在 src/assets，由 Vite 插件在 dev 提供并输出到产物）
├── Dockerfile              # 多阶段：node:22-alpine 构建 → caddy:2-alpine 托管 dist/（容器内 28080）
├── Caddyfile               # Caddy 静态托管配置（压缩 / SPA 回退 / 缓存头 / 安全头）
├── docker-compose.yml      # 本机构建 + 28080:28080 运行
├── .dockerignore
├── image.build.ps1         # 构建镜像并打时间戳标签（与 DyneCloud 其它项目同一套写法）
├── image.push.ps1          # 打 Harbor 标签并推送
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
        ├── StatusBar.vue       # 保存状态 · 编码 · 语言 · 占用 · GitHub 仓库入口 · 字符统计
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

### 许可证

项目以 **MIT** 发布（2026-09 决定）。`LICENSE` 取自
[`spdx/license-list-data`](https://github.com/spdx/license-list-data) 的 `text/MIT.txt` **原文**，
只把 `Copyright (c) <year> <copyright holders>` 换成署名行 —— 协议正文不要手打或改写，
将来若换协议同理（这台机器的 HTTPS 到 GitHub 不通，可用
`git clone --depth 1 --filter=blob:none --sparse` + `sparse-checkout set --no-cone '/text/<ID>.txt'` 经 SSH 取）。
机器可读的标识同步写在 `package.json` 与 `package-lock.json` 的 `license` 字段。

### 提交约定

提交按**功能点**分门别类（一个功能点一个提交，附带该功能点的测试结论），并一律走 GPG 签名
（`commit.gpgsign` / `tag.gpgsign` 为 true；AI 的 shell 是非交互的，签名失败时应请人执行 `gpg-unlock`，
不要加 `--no-gpg-sign` 绕过）。

## CI 与部署（GitHub Pages）

`.github/workflows/ci.yml`：**main 分支每次推送**（以及 Actions 页面手动 `workflow_dispatch`）时，
依次跑 类型检查 → 构建 → 校验产物路径 → 发布到 GitHub Pages。

- 需要仓库设置里把 **Settings → Pages → Source 设为「GitHub Actions」**；在那之前 workflow 会给出警告并跳过 deploy，
  build 步骤仍会正常跑完并上传产物；设置完成后重新运行即可真正发布；
- Node 用 22（本地是 24，Vite 8 两者都支持），依赖走 `npm ci` + setup-node 的 npm 缓存；
- `permissions` 需要 `pages: write` + `id-token: write`（deploy-pages 走 OIDC），
  `concurrency: pages` 保证同一时间只有一次部署。

### 子路径部署（最容易踩的坑）

项目站点地址是 `https://<user>.github.io/<repo>/`，**不是根路径**，所以构建必须带 `base`：

- workflow 按仓库名算出 `/litepad/`（用户主页仓库 `<user>.github.io` 则为 `/`），
  再执行 `npm run build -- --base=/litepad/`；
- 带 base 后有两处 Vite **不会**自动照顾好：
  1. **插件 emit 出来的 `favicon.svg`**：它不属于 Vite 眼中的 public 资源，
     HTML 里的 `href="/favicon.svg"` 不会被补前缀（同一份 HTML 里的 `/favicon.ico` 等来自 `public/`，
     会被正常改写）→ 由 `vite.config.ts` 里 favicon 插件的 `transformIndexHtml`（`order: 'post'`）自己补；
     dev 中间件同样先剥掉 base 前缀再比对 URL；
  2. **`public/site.webmanifest` 内部的路径**：public 文件是原样拷贝、不会被改写 →
     清单里的 `start_url` / `scope` / `icons[].src` 一律用**相对路径**，根路径与子路径两种部署都成立；
- 部署前 workflow 会做一次**产物路径校验**：`dist/index.html` 里任何 `="/...` 的地址都必须带 base 前缀，
  否则直接失败。这条检查是实测踩坑后加的 —— 第一次带 base 构建时 `favicon.svg` 就漏了前缀，
  真发上去图标会 404。

### 本地验证 Pages 产物

```bash
# 构造 Pages 形态的产物（输出到仓库外，避免触发 dev server 的 watch）
npm run build -- --base=/litepad/ --outDir ../.pages-build --emptyOutDir
node ../e2e/pages-build-check.cjs ../.pages-build /litepad/
```

`../e2e/pages-build-check.cjs` 把产物当成部署在 `/<repo>/` 下的站点跑起来（用 Playwright 的 route
直接把文件喂给浏览器，不需要额外起服务），断言：应用启动、Monaco 挂载、worker/JS/CSS/图标/清单
全部命中 base 前缀、零 404、零控制台报错、输入与自动保存正常。

## Docker 与镜像发布

约定沿用同组织其它项目（`~/projects/shared/DyneCloud/` 下的 Home / Blog-Site）：

- 多阶段构建：`node:22-alpine`（`npm ci` + `npm run build`）→ `caddy:2-alpine` 只托管静态产物；
  容器内端口 **28080 = 本地 dev 端口 18080 + 10000**，`EXPOSE`/`Caddyfile`/compose 三处保持一致；
- 镜像名 `dynecloud-litepad`，推送到 Harbor `registry.services.nimatattic.net` 的 `dynecloud` 项目，
  即 `registry.services.nimatattic.net/dynecloud/dynecloud-litepad:latest`
  （地址与写法来自 `DyneCloud/Blog-Site/image.push.ps1`）；
- **构建上下文里没有 `.git`**（`.dockerignore` 排除了），因此 `__APP_BUILD__` / `__APP_REPO__`
  改由构建参数 `APP_BUILD` / `APP_REPO_URL` 注入（`vite.config.ts` 里优先读环境变量）；
  `image.build.ps1` 会自动读取当前仓库的 `git rev-parse --short HEAD` 与 origin 传进去。
  不传也能构建：构建号回退 `dev`，顶栏/底栏的 GitHub 入口自动隐藏；
- 容器里是用**根路径** `base=/` 构建的（Pages 那份才需要 `--base=/litepad/`），
  用 `node ../e2e/pages-build-check.cjs <产物目录> /` 可以按容器形态做一次自检。

### 构建/推送脚本

| 脚本 | 平台 |
| --- | --- |
| `image.build.ps1` / `image.push.ps1` | Windows / PowerShell（与 DyneCloud 其它项目一致） |
| `image.build.sh` / `image.push.sh` | Linux / macOS；探测到直连 `docker.sock` 无权限时**自动改用 `sudo docker`** |

两个 `.sh` 里的 `git remote` → 网址换算与 `vite.config.ts` 的 `normalizeRemoteUrl` 行为一致
（注意 bash 是 POSIX 正则会「最左最长」匹配，`(.+?)(\.git)?$` 不会像 JS 那样优先吃掉 `.git`，
所以脚本里统一再 `%.git` 一次 —— 这个坑实测踩过）。

> **本机 AI 会话跑不了 docker**（已从三个角度确认，不是沙箱策略问题）：
> `/var/run/docker.sock` 真实属主是 `root:docker (0:983)`、权限 `660`，而 `docker` 组**没有任何成员**
> （本机是靠 `sudo docker` 用的）；会话既不在该组，`sudo` 又被 `no_new_privs` 拦住，
> 且没有 rootless socket / TCP 2375 / podman / buildah / skopeo / crane 等替代品。
> 因此镜像构建与推送请在终端执行：`sudo ./image.build.sh && sudo ./image.push.sh`。
> 若希望会话也能自己推，需要把运行 DSH 的用户加进 `docker` 组（`sudo usermod -aG docker <user>`）
> 并重启 DSH 运行时让新组生效 —— 注意 `docker` 组等价于 root 权限。

### Harbor 权限（实测）

登录凭据存在 `~/.docker/config.json`（账号 `dev-01`），`GET /v2/` 带认证返回 200，
但**该账号对 `dynecloud` 项目没有任何权限**：

```bash
# 用这个可以自查：返回的 JWT 里 access[0].actions 为空数组 = 无权限
curl -s -u "$USER:$PASS" \
  "https://registry.services.nimatattic.net/service/token?service=harbor-registry&scope=repository:dynecloud/dynecloud-litepad:pull,push"
```

实测结果：`dynecloud/*` 的 actions 恒为 `[]`，`GET /api/v2.0/projects/dynecloud` 返回 **403**，
而该账号可见的项目只有 `customers`(projectAdmin) / `services`(maintainer) / `static-sites`(developer)
/ `default` / `third-party`。也就是说：**不改权限的话，push 会被拒**（`denied: requested access to the resource is denied`）。
解决方式二选一：在 Harbor 里把推送用的账号加进 `dynecloud` 项目（Developer 及以上）；
或者改推该账号已有权限的项目（`static-sites` 下已有 `nimatattic-landing-*` 这类静态站镜像）。

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
CI 里只跑 `typecheck` + `build` + 产物路径校验 —— 这些套件在仓库外，runner 上拿不到。

> 跑套件前先确认 Vite 的 HMR 已经更新完毕：**刚改完源码就立刻开跑，偶发会撞上模块更新中途**
> （表现是某一条无关断言失败，重跑即过；已遇到两次，未留下具体断言名）。

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
- `legacy/scratch.html` 是最初原型，保留只为对照，随时可删。
