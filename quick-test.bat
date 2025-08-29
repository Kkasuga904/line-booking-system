@echo off
REM ========================================
REM クイックテスト - Cloud Run動作確認
REM ========================================

echo.
echo ===== Cloud Run クイックテスト =====
echo.

set PROJECT_ID=line-booking-prod-20241228
set REGION=asia-northeast1
set SERVICE_NAME=line-booking-api

REM プロジェクト設定
gcloud config set project %PROJECT_ID% 2>nul

REM サービスURL取得
echo サービスURL取得中...
for /f "tokens=*" %%i in ('gcloud run services describe %SERVICE_NAME% --region %REGION% --format "value(status.url)" 2^>nul') do set SERVICE_URL=%%i

if not defined SERVICE_URL (
    echo.
    echo エラー: サービスが見つかりません
    echo.
    echo デプロイされているサービス一覧:
    gcloud run services list --region %REGION%
    echo.
    pause
    exit /b 1
)

cls
echo ========================================
echo  Cloud Run デプロイ成功！
echo ========================================
echo.
echo サービスURL: 
echo %SERVICE_URL%
echo.
echo Webhook URL（LINE Developersに設定）:
echo %SERVICE_URL%/webhook
echo.
echo ========================================
echo.

echo [1] ヘルスチェック実行中...
echo ----------------------------------------
curl -s %SERVICE_URL%/api/ping
echo.
echo.

echo [2] Webhookテスト（簡易）...
echo ----------------------------------------
curl -s -X POST %SERVICE_URL%/webhook -H "Content-Type: application/json" -d "{\"events\":[]}"
echo.
echo.

echo ========================================
echo  次のアクション
echo ========================================
echo.
echo 1. LINE Developersで Webhook URLを更新:
echo    %SERVICE_URL%/webhook
echo.
echo 2. LINEアプリで「予約」と送信してテスト
echo.
echo 3. 管理画面を確認:
echo    %SERVICE_URL%/admin
echo.
echo 4. ログをリアルタイム監視:
echo    gcloud logging tail "resource.type=cloud_run_revision"
echo.
echo ========================================
echo.
echo 管理画面をブラウザで開きますか？ (Y/N)
set /p OPEN_ADMIN=

if /i "%OPEN_ADMIN%"=="Y" (
    start %SERVICE_URL%/admin
)

echo.
pause