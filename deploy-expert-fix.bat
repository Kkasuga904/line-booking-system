@echo off
echo Deploying expert-fixed version to Cloud Run...
echo.

cd /d "C:\Users\user\line-booking-system"

echo Current version: 3.0.0-expert-fix
echo.

echo Starting deployment...
gcloud run deploy line-booking-api ^
  --source . ^
  --region asia-northeast1 ^
  --allow-unauthenticated ^
  --platform managed ^
  --project line-booking-system ^
  --timeout 60 ^
  --memory 256Mi ^
  --max-instances 10 ^
  --min-instances 0 ^
  --quiet

echo.
echo Checking deployment status...
gcloud run services describe line-booking-api --region asia-northeast1 --format="value(status.url)" --project line-booking-system

echo.
echo Testing /api/version endpoint...
curl -s https://line-booking-api-116429620992.asia-northeast1.run.app/api/version

echo.
echo.
echo Deployment complete!
echo.
echo Next steps:
echo 1. Test webhook with LINE app (send "予約")
echo 2. Check logs: gcloud logging read "resource.type=cloud_run_revision" --limit 10
echo 3. Admin panel: https://line-booking-api-116429620992.asia-northeast1.run.app/admin
echo.
pause