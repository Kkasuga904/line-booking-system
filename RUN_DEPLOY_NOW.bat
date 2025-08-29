@echo off
echo ========================================
echo LINE予約システム GCP デプロイ開始
echo ========================================
echo.

cd /d C:\Users\user\line-booking-system

echo ステップ 1: プロジェクト設定
call gcloud config set project line-booking-prod-20241228

echo.
echo ステップ 2: APIの有効化
call gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

echo.
echo ステップ 3: リポジトリ作成
call gcloud artifacts repositories create line-booking --repository-format=docker --location=asia-northeast1 --quiet 2>nul

echo.
echo ステップ 4: Docker認証
call gcloud auth configure-docker asia-northeast1-docker.pkg.dev --quiet

echo.
echo ステップ 5: Dockerビルド
docker build -t asia-northeast1-docker.pkg.dev/line-booking-prod-20241228/line-booking/line-booking-api:latest .

echo.
echo ステップ 6: Dockerプッシュ
docker push asia-northeast1-docker.pkg.dev/line-booking-prod-20241228/line-booking/line-booking-api:latest

echo.
echo ステップ 7: Cloud Runデプロイ
call gcloud run deploy line-booking-api ^
  --image asia-northeast1-docker.pkg.dev/line-booking-prod-20241228/line-booking/line-booking-api:latest ^
  --platform managed ^
  --region asia-northeast1 ^
  --allow-unauthenticated ^
  --memory 512Mi ^
  --cpu 1 ^
  --min-instances 1 ^
  --max-instances 100 ^
  --port 8080 ^
  --quiet

echo.
echo ========================================
echo デプロイ完了！
echo ========================================
echo.
echo サービスURL:
call gcloud run services describe line-booking-api --region asia-northeast1 --format "value(status.url)"

echo.
echo 次のステップ:
echo 1. 環境変数を設定してください（LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN等）
echo 2. LINE Developers ConsoleでWebhook URLを設定してください
echo.
pause