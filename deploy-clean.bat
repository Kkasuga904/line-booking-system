@echo off
echo Clean deployment to Cloud Run...
echo.

cd /d "C:\Users\user\line-booking-system"

echo Current directory:
cd
echo.

echo Files being deployed:
dir /b *.js *.json Dockerfile
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
  --min-instances 0

echo.
echo Deployment status:
gcloud run services describe line-booking-api --region asia-northeast1 --format="value(status.url)"

echo.
pause