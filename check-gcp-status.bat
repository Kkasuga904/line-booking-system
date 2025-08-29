@echo off
REM ========================================
REM GCPデプロイ状態確認スクリプト
REM ========================================

echo.
echo ===== GCPデプロイ状態確認 =====
echo.

set PROJECT_ID=line-booking-prod-20241228
set REGION=asia-northeast1
set SERVICE_NAME=line-booking-api

echo [プロジェクト情報]
echo プロジェクトID: %PROJECT_ID%
echo リージョン: %REGION%
echo サービス名: %SERVICE_NAME%
echo.

REM 現在のプロジェクト確認
echo [現在の設定]
gcloud config get-value project
echo.

REM 有効なAPI確認
echo [有効化されたAPI]
gcloud services list --enabled --filter="NAME:run OR NAME:secretmanager OR NAME:cloudbuild OR NAME:artifactregistry" --format="table(NAME,TITLE)"
echo.

REM シークレット確認
echo [登録済みシークレット]
gcloud secrets list --format="table(NAME,CREATE_TIME)"
echo.

REM Cloud Runサービス確認
echo [Cloud Runサービス]
gcloud run services list --region %REGION% --format="table(SERVICE,REGION,URL,LAST_DEPLOYED_BY)"
echo.

REM サービスURL取得
for /f "tokens=*" %%i in ('gcloud run services describe %SERVICE_NAME% --region %REGION% --format "value(status.url)" 2^>nul') do set SERVICE_URL=%%i

if defined SERVICE_URL (
    echo.
    echo [デプロイ済みサービス情報]
    echo ========================================
    echo サービスURL: %SERVICE_URL%
    echo Webhook URL: %SERVICE_URL%/webhook
    echo ========================================
    echo.
    echo [ヘルスチェックテスト]
    curl %SERVICE_URL%/api/ping
    echo.
) else (
    echo.
    echo ※ サービスがまだデプロイされていません
    echo   deploy-gcp.bat を実行してください
    echo.
)

echo.
echo [最近のログ（エラーのみ）]
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" --limit 5 --format="table(timestamp,jsonPayload.message)"
echo.

pause