@echo off
echo ===========================================
echo Deploying Raw Buffer Version (v4.0.0)
echo ===========================================
echo.

cd /d "C:\Users\user\line-booking-system"

echo Deploying to Cloud Run...
gcloud run deploy line-booking-api ^
  --source . ^
  --region asia-northeast1 ^
  --allow-unauthenticated ^
  --project line-booking-system

echo.
echo Deployment complete!
echo.
echo Testing version:
curl -s https://line-booking-api-116429620992.asia-northeast1.run.app/api/version

echo.
pause