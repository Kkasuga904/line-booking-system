@echo off
echo ========================================
echo 緊急デプロイ - ソースから直接
echo ========================================
echo.

cd /d C:\Users\user\line-booking-system

echo プロジェクト設定中...
call gcloud config set project line-booking-prod-20241228

echo.
echo ========================================
echo ソースコードから直接デプロイ
echo （Dockerビルド不要・Cloud Buildが自動処理）
echo ========================================
echo.
echo デプロイ開始... (3-5分かかります)
echo.

call gcloud run deploy line-booking-api ^
    --source . ^
    --region asia-northeast1 ^
    --project line-booking-prod-20241228 ^
    --allow-unauthenticated ^
    --memory 512Mi ^
    --cpu 1 ^
    --min-instances 1 ^
    --max-instances 100 ^
    --port 8080

if errorlevel 1 (
    echo.
    echo ❌ デプロイに失敗しました
    echo.
    echo 以下を確認してください：
    echo 1. Google Cloud SDK Shellで実行しているか
    echo 2. gcloudにログインしているか (gcloud auth login)
    echo 3. プロジェクトIDが正しいか
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ デプロイ完了！
echo ========================================
echo.

echo Webhookエンドポイント確認中...
curl -I https://line-booking-api-116429620992.asia-northeast1.run.app/api/webhook 2>nul | find "HTTP"

echo.
echo ========================================
echo 重要な URL
echo ========================================
echo.
echo LINE Webhook URL（Developers Consoleに設定）:
echo https://line-booking-api-116429620992.asia-northeast1.run.app/api/webhook
echo.
echo 管理画面:
echo https://line-booking-api-116429620992.asia-northeast1.run.app/admin-calendar
echo.
echo ヘルスチェック:
echo https://line-booking-api-116429620992.asia-northeast1.run.app/api/ping
echo.

pause