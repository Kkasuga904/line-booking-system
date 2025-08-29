@echo off
REM ========================================
REM GCPデプロイテストスクリプト
REM ========================================

echo.
echo ===== Cloud Runデプロイテスト =====
echo.

set PROJECT_ID=line-booking-prod-20241228
set REGION=asia-northeast1
set SERVICE_NAME=line-booking-api

REM サービスURL取得
for /f "tokens=*" %%i in ('gcloud run services describe %SERVICE_NAME% --region %REGION% --format "value(status.url)" 2^>nul') do set SERVICE_URL=%%i

if not defined SERVICE_URL (
    echo エラー: サービスがデプロイされていません
    echo deploy-gcp.bat を先に実行してください
    pause
    exit /b 1
)

echo サービスURL: %SERVICE_URL%
echo.

echo [1] ヘルスチェック (/api/ping)
echo ----------------------------------------
curl -s %SERVICE_URL%/api/ping
echo.
echo.

echo [2] バージョン確認 (/api/version)
echo ----------------------------------------
curl -s %SERVICE_URL%/api/version
echo.
echo.

echo [3] Webhookテスト（空リクエスト）
echo ----------------------------------------
curl -X POST %SERVICE_URL%/webhook -H "Content-Type: application/json" -d "{}"
echo.
echo.

echo [4] Webhookテスト（予約メッセージ）
echo ----------------------------------------
curl -X POST %SERVICE_URL%/webhook ^
  -H "Content-Type: application/json" ^
  -d "{\"events\":[{\"type\":\"message\",\"message\":{\"type\":\"text\",\"text\":\"予約\"},\"source\":{\"type\":\"user\",\"userId\":\"test-user\"},\"replyToken\":\"test-token\"}]}"
echo.
echo.

echo [5] 管理画面アクセステスト
echo ----------------------------------------
echo 管理画面URL: %SERVICE_URL%/admin
echo ブラウザで開きますか？ (Y/N)
set /p OPEN_BROWSER=

if /i "%OPEN_BROWSER%"=="Y" (
    start %SERVICE_URL%/admin
)

echo.
echo [6] 直近のログ確認（最新10件）
echo ----------------------------------------
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=%SERVICE_NAME%" --limit 10 --format="table(timestamp,jsonPayload.message)"
echo.

echo.
echo ========================================
echo テスト完了！
echo.
echo 次のステップ:
echo 1. LINE DevelopersでWebhook URLを更新
echo    %SERVICE_URL%/webhook
echo.
echo 2. LINEアプリから「予約」と送信してテスト
echo.
echo 3. 問題があれば以下でログ確認:
echo    gcloud logging tail "resource.type=cloud_run_revision"
echo ========================================
echo.
pause