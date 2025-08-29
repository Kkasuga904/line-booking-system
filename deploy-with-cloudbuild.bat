@echo off
echo ========================================
echo Cloud Build を使用したデプロイ
echo ========================================
echo.

cd /d C:\Users\user\line-booking-system

echo Cloud Buildでビルドとデプロイを実行中...
echo.

gcloud builds submit ^
    --tag asia-northeast1-docker.pkg.dev/line-booking-prod-20241228/line-booking/line-booking-api:latest ^
    --project line-booking-prod-20241228 ^
    --region asia-northeast1

echo.
echo Cloud Runへのデプロイ...
gcloud run deploy line-booking-api ^
    --image asia-northeast1-docker.pkg.dev/line-booking-prod-20241228/line-booking/line-booking-api:latest ^
    --platform managed ^
    --region asia-northeast1 ^
    --project line-booking-prod-20241228 ^
    --allow-unauthenticated ^
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
echo サービスURL:
echo https://line-booking-api-116429620992.asia-northeast1.run.app
echo.
echo Webhook URL:
echo https://line-booking-api-116429620992.asia-northeast1.run.app/api/webhook
echo.
pause