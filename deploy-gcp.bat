@echo off
REM ========================================
REM GCP Cloud Run デプロイスクリプト
REM ========================================

echo.
echo ===== GCP Cloud Run デプロイ開始 =====
echo.

REM プロジェクトID設定（ユニークな値にする）
set PROJECT_ID=line-booking-prod-20241228
set REGION=asia-northeast1
set SERVICE_NAME=line-booking-api

echo プロジェクト: %PROJECT_ID%
echo リージョン: %REGION%
echo サービス名: %SERVICE_NAME%
echo.

REM 1. プロジェクト作成
echo [1/7] プロジェクト作成中...
gcloud projects create %PROJECT_ID% --name="LINE Booking System" 2>nul
if %ERRORLEVEL% equ 0 (
    echo ✓ プロジェクト作成完了
) else (
    echo ※ プロジェクトが既に存在するか、エラーが発生しました
)

REM 2. プロジェクト設定
echo [2/7] プロジェクト設定中...
gcloud config set project %PROJECT_ID%
gcloud config set compute/region %REGION%
echo ✓ プロジェクト設定完了

REM 3. 請求先確認
echo.
echo [3/7] 請求先アカウントをリンクしてください
echo 以下のコマンドで請求先IDを確認:
echo   gcloud billing accounts list
echo.
echo 確認後、以下のコマンドでリンク:
echo   gcloud billing projects link %PROJECT_ID% --billing-account=YOUR_BILLING_ID
echo.
pause

REM 4. API有効化
echo [4/7] 必要なAPIを有効化中...
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable cloudbuild.googleapis.com
echo ✓ API有効化完了

REM 5. シークレット作成
echo.
echo [5/7] シークレット作成中...

echo LINE_CHANNEL_ACCESS_TOKEN設定...
echo 2l2dPaFJzJm9dOGWUDWjSkTd4q6rPFCQyNlJCsjroXvp8ms5ixN5y5wLaWkdL7yvbjGhrREmcrINg4sT+8/nKhExKuolhDSfddrgv9ZNqHwamM43ELsG51/IVWsdaRTxnAyRHCj6+pdQrhQmnw1f/wdB04t89/1O/w1cDnyilFU= | gcloud secrets create line-channel-access-token --data-file=- 2>nul

echo LINE_CHANNEL_SECRET設定...
echo c093c9b8e2c2e80ce48f039e6833f636 | gcloud secrets create line-channel-secret --data-file=- 2>nul

echo SUPABASE_URL設定...
echo https://faenvzzeguvlconvrqgp.supabase.co | gcloud secrets create supabase-url --data-file=- 2>nul

echo SUPABASE_ANON_KEY設定...
echo eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8 | gcloud secrets create supabase-anon-key --data-file=- 2>nul

echo ✓ シークレット設定完了

REM 6. Cloud Runデプロイ
echo.
echo [6/7] Cloud Runへデプロイ中... (数分かかります)
cd /d %~dp0
gcloud run deploy %SERVICE_NAME% ^
  --source . ^
  --region %REGION% ^
  --platform managed ^
  --allow-unauthenticated ^
  --min-instances 0 ^
  --max-instances 10 ^
  --cpu 1 ^
  --memory 512Mi ^
  --timeout 60 ^
  --update-secrets=LINE_CHANNEL_ACCESS_TOKEN=line-channel-access-token:latest,LINE_CHANNEL_SECRET=line-channel-secret:latest,SUPABASE_URL=supabase-url:latest,SUPABASE_ANON_KEY=supabase-anon-key:latest ^
  --set-env-vars=NODE_ENV=production,STORE_ID=default-store,LIFF_ID=2006487876-xd1A5qJB

if %ERRORLEVEL% equ 0 (
    echo ✓ デプロイ完了！
) else (
    echo × デプロイ失敗
    echo エラーログを確認してください:
    echo   gcloud logging read "severity=ERROR" --limit 50
    pause
    exit /b 1
)

REM 7. デプロイ結果表示
echo.
echo [7/7] デプロイ情報:
echo ========================================
for /f "tokens=*" %%i in ('gcloud run services describe %SERVICE_NAME% --region %REGION% --format "value(status.url)"') do set SERVICE_URL=%%i
echo サービスURL: %SERVICE_URL%
echo Webhook URL: %SERVICE_URL%/webhook
echo ========================================
echo.
echo 次のステップ:
echo 1. LINE Developers Consoleで Webhook URLを更新
echo    %SERVICE_URL%/webhook
echo.
echo 2. ヘルスチェック:
echo    curl %SERVICE_URL%/api/ping
echo.
echo 3. LINEアプリで「予約」と送信してテスト
echo.
pause