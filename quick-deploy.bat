@echo off
echo Deploying fixed server.js to Cloud Run...
echo.

cd /d "C:\Users\user\line-booking-system"

gcloud run deploy line-booking-api ^
  --source . ^
  --region asia-northeast1 ^
  --allow-unauthenticated ^
  --platform managed ^
  --project line-booking-system ^
  --quiet

echo.
echo Deployment complete!
pause