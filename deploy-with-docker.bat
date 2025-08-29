@echo off
echo ========================================
echo LINE予約システム - Docker デプロイ
echo プロジェクト: line-booking-prod-20241228
echo ========================================
echo.

cd /d C:\Users\user\line-booking-system

REM Docker Desktop起動確認
echo Docker Desktopの起動を確認中...
docker version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ⚠️ Docker Desktopが起動していません！
    echo.
    echo 1. Docker Desktopを起動してください
    echo 2. Docker Desktopが完全に起動するまで待ってください（約30秒）
    echo 3. その後、このスクリプトを再実行してください
    echo.
    echo Docker Desktopを起動中...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo.
    pause
    exit /b 1
)

echo ✅ Docker Desktop起動確認OK
echo.

REM プロジェクトとリージョンの設定
set PROJECT_ID=line-booking-prod-20241228
set REGION=asia-northeast1
set IMAGE_TAG=asia-northeast1-docker.pkg.dev/%PROJECT_ID%/line-booking/line-booking-api:latest

echo ========================================
echo ステップ 1: Docker認証設定
echo ========================================
call gcloud auth configure-docker %REGION%-docker.pkg.dev --quiet
if errorlevel 1 (
    echo Docker認証に失敗しました
    pause
    exit /b 1
)

echo.
echo ========================================
echo ステップ 2: Dockerイメージのビルド
echo ========================================
echo ビルド中... (3-5分かかります)
docker build -t %IMAGE_TAG% .
if errorlevel 1 (
    echo Dockerビルドに失敗しました
    pause
    exit /b 1
)

echo.
echo ========================================
echo ステップ 3: Dockerイメージのプッシュ
echo ========================================
echo プッシュ中... (2-3分かかります)
docker push %IMAGE_TAG%
if errorlevel 1 (
    echo Dockerプッシュに失敗しました
    pause
    exit /b 1
)

echo.
echo ========================================
echo ステップ 4: Cloud Runへのデプロイ
echo ========================================
call gcloud run deploy line-booking-api ^
    --image %IMAGE_TAG% ^
    --platform managed ^
    --region %REGION% ^
    --project %PROJECT_ID% ^
    --allow-unauthenticated ^
    --memory 512Mi ^
    --cpu 1 ^
    --min-instances 1 ^
    --max-instances 100 ^
    --port 8080 ^
    --quiet

if errorlevel 1 (
    echo Cloud Runデプロイに失敗しました
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ デプロイ完了！
echo ========================================
echo.
echo サービスURL:
echo https://line-booking-api-116429620992.asia-northeast1.run.app
echo.
echo Webhook URL（LINE Developers Consoleに設定）:
echo https://line-booking-api-116429620992.asia-northeast1.run.app/api/webhook
echo.
echo 管理画面:
echo https://line-booking-api-116429620992.asia-northeast1.run.app/admin-calendar
echo.

REM デプロイ確認
echo ========================================
echo デプロイ確認中...
echo ========================================
curl -I https://line-booking-api-116429620992.asia-northeast1.run.app/api/webhook 2>nul | find "HTTP"
echo.

echo 完了しました！
pause