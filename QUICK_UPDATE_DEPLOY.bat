@echo off
echo ========================================
echo LINE予約システム - 更新デプロイ
echo プロジェクト: line-booking-prod-20241228
echo ========================================
echo.

cd /d C:\Users\user\line-booking-system

echo Dockerイメージのビルド...
docker build -t asia-northeast1-docker.pkg.dev/line-booking-prod-20241228/line-booking/line-booking-api:latest .

echo.
echo Dockerイメージのプッシュ...
docker push asia-northeast1-docker.pkg.dev/line-booking-prod-20241228/line-booking/line-booking-api:latest

echo.
echo Cloud Runの更新...
call gcloud run deploy line-booking-api ^
  --image asia-northeast1-docker.pkg.dev/line-booking-prod-20241228/line-booking/line-booking-api:latest ^
  --platform managed ^
  --region asia-northeast1 ^
  --quiet

echo.
echo ========================================
echo 更新完了！
echo ========================================
echo.
echo Webhook URL:
echo https://line-booking-api-116429620992.asia-northeast1.run.app/api/webhook
echo.
pause