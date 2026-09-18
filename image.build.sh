#!/usr/bin/env bash
# 构建镜像并打时间戳标签（Linux/macOS 版；PowerShell 见 image.build.ps1）
# 用法：./image.build.sh
#   - 本机 docker 需要 sudo 时会自动加上（可用 DOCKER="sudo docker" 覆盖）
set -euo pipefail

cd "$(dirname "$0")"

IMAGE_NAME="dynecloud-litepad"
DT_TAG="$(date +%Y-%m%d-%H%M)"

# 没有权限直连 docker.sock 时自动走 sudo（本机 docker 组为空，就是这么用的）
if docker info >/dev/null 2>&1; then
  DOCKER="${DOCKER:-docker}"
else
  DOCKER="${DOCKER:-sudo docker}"
fi

# 容器里没有 .git：构建号与仓库地址在这里读出来传进构建阶段
BUILD_ID="$(git rev-parse --short HEAD 2>/dev/null || echo dev)"
REMOTE="$(git remote get-url origin 2>/dev/null || true)"
if [[ "$REMOTE" =~ ^(ssh://)?git@([^:/]+)[:/](.+)$ ]]; then
  REPO_URL="https://${BASH_REMATCH[2]}/${BASH_REMATCH[3]}"
else
  REPO_URL="$REMOTE"
fi
# bash 是 POSIX 正则（最左最长匹配），`(.+?)(\.git)?$` 不会像 JS 那样优先吃掉 .git，
# 所以这里统一去掉结尾的 .git
REPO_URL="${REPO_URL%.git}"

echo ">>> Building image ${IMAGE_NAME}:${DT_TAG} (APP_BUILD=${BUILD_ID}, APP_REPO_URL=${REPO_URL}) ..."
$DOCKER build \
  --build-arg "APP_BUILD=${BUILD_ID}" \
  --build-arg "APP_REPO_URL=${REPO_URL}" \
  -t "${IMAGE_NAME}:${DT_TAG}" .

echo ">>> Tagging ${IMAGE_NAME}:${DT_TAG} as ${IMAGE_NAME}:latest ..."
$DOCKER tag "${IMAGE_NAME}:${DT_TAG}" "${IMAGE_NAME}:latest"
