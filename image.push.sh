#!/usr/bin/env bash
# 推送到远端 Harbor 的 dynecloud 项目（地址与命名约定同 DyneCloud 其它项目）
# 用法：先跑 ./image.build.sh，再执行 ./image.push.sh
#
# 前置条件：
#   1) 已登录：docker login registry.services.nimatattic.net
#      （或用 docker login -u <账号> 交互输入密码）
#   2) 该账号对 dynecloud 项目有 push 权限 —— 否则会报
#      "denied: requested access to the resource is denied"。
#      用以下命令可以自查是否具备权限：
#        curl -s -u "$USER:$PASS" \
#          "https://registry.services.nimatattic.net/service/token?service=harbor-registry&scope=repository:dynecloud/dynecloud-litepad:pull,push"
#      返回的 JWT 里 access[0].actions 若为空数组，就说明没有权限。
set -euo pipefail

cd "$(dirname "$0")"

HARBOR_HOST="registry.services.nimatattic.net"
IMAGE_NAME="dynecloud-litepad"
PROJECT="dynecloud"
TARGET="${HARBOR_HOST}/${PROJECT}/${IMAGE_NAME}:latest"

if docker info >/dev/null 2>&1; then
  DOCKER="${DOCKER:-docker}"
else
  DOCKER="${DOCKER:-sudo docker}"
fi

echo ">>> Tagging image ${IMAGE_NAME}:latest as ${TARGET} ..."
$DOCKER tag "${IMAGE_NAME}:latest" "${TARGET}"

echo ">>> Pushing image ${TARGET} ..."
$DOCKER push "${TARGET}"
