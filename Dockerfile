# ---- 构建阶段 ----
# 用 npm（本仓库是 package-lock.json）；注意**不要**设 NODE_ENV=production，
# 否则 npm ci 会跳过 devDependencies，vite/tsc 就没了。
FROM node:22-alpine AS builder

WORKDIR /app

# 容器里没有 .git，构建号与仓库地址改由这两个参数传入（vite.config.ts 里读取）。
# 都不传也能构建：构建号回退 dev，顶栏/底栏的 GitHub 入口自动隐藏。
ARG APP_BUILD=dev
ARG APP_REPO_URL=https://github.com/Dynesshely/litepad

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN APP_BUILD="$APP_BUILD" APP_REPO_URL="$APP_REPO_URL" npm run build

# ---- 运行阶段 ----
FROM caddy:2-alpine

COPY --from=builder /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile

# 端口 = 本地 dev 端口(18080) + 10000
EXPOSE 28080
