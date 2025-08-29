@echo off
echo Deploying fixed signature verification version to Cloud Run...
echo.

cd /d "C:\Users\user\line-booking-system"

echo Building and deploying...
gcloud run deploy line-booking-api ^
  --source . ^
  --region asia-northeast1 ^
  --allow-unauthenticated ^
  --platform managed ^
  --project line-booking-system ^
  --quiet

echo.
echo Deployment complete!
echo Service URL: https://line-booking-api-116429620992.asia-northeast1.run.app
echo.
echo Test with LINE app by sending:
echo - "予約" for booking
echo - "確認" to check reservations  
echo - "キャンセル" to cancel
echo.
pause