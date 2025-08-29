@echo off
echo ========================================
echo LINE予約システム - GCP Cloud Run 自動デプロイ
echo プロジェクト: line-booking-prod-20241228
echo ========================================
echo.

REM パスの設定
set GCLOUD_PATH="C:\Users\user\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud"
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
%GCLOUD_PATH% config set project %PROJECT_ID%

REM 必要なAPIを有効化
echo.
echo 必要なAPIを有効化中...
%GCLOUD_PATH% services enable run.googleapis.com
%GCLOUD_PATH% services enable cloudbuild.googleapis.com
%GCLOUD_PATH% services enable artifactregistry.googleapis.com
%GCLOUD_PATH% services enable secretmanager.googleapis.com

REM Artifact Registryリポジトリ作成
echo.
echo Artifact Registryリポジトリを確認/作成中...
%GCLOUD_PATH% artifacts repositories create line-booking ^
    --repository-format=docker ^
    --location=%REGION% ^
    --description="LINE予約システムのDockerイメージ" 2>nul

echo.
echo ========================================
echo Docker イメージのビルドとプッシュ
echo ========================================

REM Docker認証設定
%GCLOUD_PATH% auth configure-docker %REGION%-docker.pkg.dev

REM イメージビルド
docker build -t %REGION%-docker.pkg.dev/%PROJECT_ID%/line-booking/%SERVICE_NAME%:latest .

REM イメージプッシュ
docker push %REGION%-docker.pkg.dev/%PROJECT_ID%/line-booking/%SERVICE_NAME%:latest

echo.
echo ========================================
echo Cloud Runへのデプロイ
echo ========================================

REM 環境変数の設定（デフォルト値を使用）
set LINE_CHANNEL_SECRET=your_channel_secret_here
set LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here
set SUPABASE_URL=https://your-project.supabase.co
set SUPABASE_ANON_KEY=your_supabase_anon_key_here

REM Cloud Runデプロイ
%GCLOUD_PATH% run deploy %SERVICE_NAME% ^
    --image %REGION%-docker.pkg.dev/%PROJECT_ID%/line-booking/%SERVICE_NAME%:latest ^
    --platform managed ^
    --region %REGION% ^
    --allow-unauthenticated ^
    --set-env-vars LINE_CHANNEL_SECRET=%LINE_CHANNEL_SECRET%,LINE_CHANNEL_ACCESS_TOKEN=%LINE_CHANNEL_ACCESS_TOKEN%,SUPABASE_URL=%SUPABASE_URL%,SUPABASE_ANON_KEY=%SUPABASE_ANON_KEY% ^
    --memory 512Mi ^
    --cpu 1 ^
    --min-instances 1 ^
    --max-instances 100 ^
    --port 8080

echo.
echo ========================================
echo デプロイ完了！
echo ========================================
echo.

REM サービスURL取得
for /f "tokens=*" %%i in ('%GCLOUD_PATH% run services describe %SERVICE_NAME% --region %REGION% --format "value(status.url)"') do set SERVICE_URL=%%i

echo サービスURL:
echo %SERVICE_URL%
echo.
echo LINE Webhook URL:
echo %SERVICE_URL%/api/webhook
echo.

echo ========================================
echo 重要: 環境変数の更新が必要です
echo ========================================
echo.
echo 以下のコマンドで実際の値に更新してください:
echo.
echo %GCLOUD_PATH% run services update %SERVICE_NAME% --region %REGION% ^
echo   --set-env-vars LINE_CHANNEL_SECRET=実際の値,LINE_CHANNEL_ACCESS_TOKEN=実際の値,SUPABASE_URL=実際の値,SUPABASE_ANON_KEY=実際の値
echo.
pause