@echo off
echo ========================================
echo LINE予約システム - GCP Cloud Run 本番デプロイ
echo プロジェクト: line-booking-prod-20241228
echo ========================================
echo.

REM プロジェクト設定
set PROJECT_ID=line-booking-prod-20241228
set REGION=asia-northeast1
set SERVICE_NAME=line-booking-api

echo [設定確認]
echo プロジェクトID: %PROJECT_ID%
echo リージョン: %REGION%
echo サービス名: %SERVICE_NAME%
echo.

REM プロジェクトをアクティブに設定
echo GCPプロジェクトを設定中...
gcloud config set project %PROJECT_ID%

REM 必要なAPIを有効化
echo.
echo 必要なAPIを有効化中...
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com

REM Artifact Registryリポジトリ作成（既存の場合はスキップ）
echo.
echo Artifact Registryリポジトリを確認/作成中...
gcloud artifacts repositories create line-booking ^
    --repository-format=docker ^
    --location=%REGION% ^
    --description="LINE予約システムのDockerイメージ" 2>nul

echo.
echo ========================================
echo 環境変数を設定してください
echo ========================================
set /p LINE_CHANNEL_SECRET="LINE Channel Secret: "
set /p LINE_CHANNEL_ACCESS_TOKEN="LINE Channel Access Token: "
set /p SUPABASE_URL="Supabase URL: "
set /p SUPABASE_ANON_KEY="Supabase Anon Key: "

REM Cloud Buildでビルドとデプロイ
echo.
echo ========================================
echo Cloud Buildを使用してデプロイ中...
echo ========================================
gcloud builds submit ^
    --config=cloudbuild.yaml ^
    --substitutions=_LINE_CHANNEL_SECRET="%LINE_CHANNEL_SECRET%",_LINE_CHANNEL_ACCESS_TOKEN="%LINE_CHANNEL_ACCESS_TOKEN%",_SUPABASE_URL="%SUPABASE_URL%",_SUPABASE_ANON_KEY="%SUPABASE_ANON_KEY%" ^
    --region=%REGION%

REM デプロイ完了後の情報表示
echo.
echo ========================================
echo デプロイが完了しました！
echo ========================================

REM サービスURLを取得
echo.
echo サービスURL:
for /f "tokens=*" %%i in ('gcloud run services describe %SERVICE_NAME% --region %REGION% --format "value(status.url)"') do set SERVICE_URL=%%i
echo %SERVICE_URL%

echo.
echo LINE Webhook URL:
echo %SERVICE_URL%/api/webhook
echo.
echo 上記のURLをLINE Developers Consoleに設定してください。

REM ヘルスチェック
echo.
echo ========================================
echo ヘルスチェック実行中...
echo ========================================
curl %SERVICE_URL%/api/ping

echo.
echo ========================================
echo ログを確認する場合:
echo gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=%SERVICE_NAME%" --limit 50 --format=json
echo ========================================
echo.
pause