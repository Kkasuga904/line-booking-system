# Google Cloud SDK インストールスクリプト (Windows PowerShell)

Write-Host "🚀 Google Cloud SDK インストール開始" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# インストーラーダウンロード
$installerUrl = "https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe"
$installerPath = "$env:TEMP\GoogleCloudSDKInstaller.exe"

Write-Host "1. インストーラーをダウンロード中..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath

Write-Host "2. インストーラーを実行中..." -ForegroundColor Yellow
Write-Host "   ※ インストーラーが開いたら、指示に従ってインストールしてください" -ForegroundColor Green
Start-Process -FilePath $installerPath -Wait

Write-Host "3. インストール完了！" -ForegroundColor Green
Write-Host ""
Write-Host "次のステップ:" -ForegroundColor Cyan
Write-Host "1. 新しいコマンドプロンプトまたはPowerShellを開く"
Write-Host "2. 以下のコマンドで確認:"
Write-Host "   gcloud --version" -ForegroundColor Yellow
Write-Host "3. 初期設定:"
Write-Host "   gcloud init" -ForegroundColor Yellow
Write-Host ""
Write-Host "※ インストール後、パスを通すために一度ターミナルを再起動してください" -ForegroundColor Red