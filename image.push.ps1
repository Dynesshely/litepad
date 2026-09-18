# 推送到远端 Harbor 的 dynecloud 项目（地址与命名约定同 DyneCloud 其它项目）
# 用法：先跑 ./image.build.ps1，再执行  pwsh ./image.push.ps1
$harborHost = "registry.services.nimatattic.net"
$imageName = "dynecloud-litepad"
$project = "dynecloud"

Write-Output ">>> Tagging image $imageName`:latest as $harborHost/$project/$imageName`:latest ..."
docker tag "$imageName`:latest" "$harborHost/$project/$imageName`:latest"

Write-Output ">>> Pushing image $harborHost/$project/$imageName`:latest ..."
docker push "$harborHost/$project/$imageName`:latest"
