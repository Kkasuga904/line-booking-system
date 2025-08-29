# Terraform インストールスクリプト (Windows PowerShell)

Write-Host "🚀 Terraform インストール開始" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Terraformバージョン
$terraformVersion = "1.6.6"
$terraformUrl = "https://releases.hashicorp.com/terraform/$terraformVersion/terraform_${terraformVersion}_windows_amd64.zip"
$downloadPath = "$env:TEMP\terraform.zip"
$installPath = "C:\terraform"

Write-Host "1. Terraform v$terraformVersion をダウンロード中..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $terraformUrl -OutFile $downloadPath

Write-Host "2. インストールディレクトリを作成中..." -ForegroundColor Yellow
if (!(Test-Path $installPath)) {
    New-Item -ItemType Directory -Path $installPath -Force | Out-Null
}

Write-Host "3. ファイルを展開中..." -ForegroundColor Yellow
Expand-Archive -Path $downloadPath -DestinationPath $installPath -Force

Write-Host "4. 環境変数PATHに追加中..." -ForegroundColor Yellow
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$installPath*") {
    [Environment]::SetEnvironmentVariable(
        "Path",
        "$currentPath;$installPath",
        "User"
    )
    Write-Host "✅ PATHに追加しました: $installPath" -ForegroundColor Green
} else {
    Write-Host "⚠️  既にPATHに含まれています" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ インストール完了！" -ForegroundColor Green
Write-Host ""
Write-Host "次のステップ:" -ForegroundColor Cyan
Write-Host "1. 新しいコマンドプロンプトまたはPowerShellを開く"
Write-Host "2. 以下のコマンドで確認:"
Write-Host "   terraform --version" -ForegroundColor Yellow
Write-Host ""
Write-Host "※ パスを反映させるために新しいターミナルを開いてください" -ForegroundColor Red

# 現在のセッションでも使えるようにする
$env:Path += ";$installPath"

# バージョン確認を試す
try {
    & "$installPath\terraform.exe" --version
} catch {
    Write-Host "現在のセッションでは使用できません。新しいターミナルを開いてください。" -ForegroundColor Yellow
}