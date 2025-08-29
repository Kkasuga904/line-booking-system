@echo off
echo ========================================
echo    Final Cloud Run Deployment
echo ========================================
echo.

cd /d C:\Users\user\line-booking-system

echo Deploying to Cloud Run...
echo This will take 5-10 minutes...
echo.

gcloud run deploy line-booking-api ^
  --source . ^
  --region asia-northeast1 ^
  --allow-unauthenticated ^
  --min-instances 0 ^
  --max-instances 10 ^
  --memory 512Mi ^
  --timeout 300 ^
  --port 8080 ^
  --update-secrets=LINE_CHANNEL_ACCESS_TOKEN=line-channel-access-token:latest,LINE_CHANNEL_SECRET=line-channel-secret:latest,SUPABASE_URL=supabase-url:latest,SUPABASE_ANON_KEY=supabase-anon-key:latest ^
  --set-env-vars=NODE_ENV=production,STORE_ID=default-store

echo.
echo ========================================
echo    Checking deployment status...
echo ========================================
echo.

for /f "tokens=*" %%i in ('gcloud run services describe line-booking-api --region asia-northeast1 --format "value(status.url)" 2^>nul') do set SERVICE_URL=%%i

if defined SERVICE_URL (
    echo SUCCESS!
    echo.
    echo Service URL: %SERVICE_URL%
    echo Webhook URL: %SERVICE_URL%/webhook
    echo.
    echo Next Steps:
    echo 1. Copy the Webhook URL above
    echo 2. Go to LINE Developers Console
    echo 3. Update Webhook URL in Messaging API settings
    echo 4. Test with LINE app
) else (
    echo Deployment may still be in progress or failed.
    echo Check status with:
    echo   gcloud run services list --region asia-northeast1
)

echo.
pause