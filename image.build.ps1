# 构建镜像并打上时间戳标签（与 DyneCloud 其它项目保持一致）
# 用法：在仓库根目录执行  pwsh ./image.build.ps1
$imageName = "dynecloud-litepad"
$dttag = $(Get-Date -Format "yyyy-MMdd-HHmm").ToString()

# 容器里没有 .git，构建号与仓库地址在这里读出来传进构建阶段
$build = ""
try { $build = (git rev-parse --short HEAD).Trim() } catch { $build = "dev" }
$repoUrl = ""
try {
    $remote = (git remote get-url origin).Trim()
    if ($remote -match '^(?:ssh://)?git@([^:/]+)[:/](.+?)(?:\.git)?$') {
        $repoUrl = "https://$($Matches[1])/$($Matches[2])"
    } elseif ($remote -match '\.git$') {
        $repoUrl = $remote -replace '\.git$', ''
    } else {
        $repoUrl = $remote
    }
} catch { $repoUrl = "" }

Write-Output ">>> Building image $imageName`:$dttag (APP_BUILD=$build, APP_REPO_URL=$repoUrl) ..."
docker build --build-arg "APP_BUILD=$build" --build-arg "APP_REPO_URL=$repoUrl" -t "$($imageName):$($dttag)" .

Write-Output ">>> Tagging $imageName`:$dttag as $imageName`:latest ..."
docker tag "$($imageName):$($dttag)" "$($imageName):latest"
