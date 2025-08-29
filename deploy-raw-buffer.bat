@echo off
echo ===========================================
echo Deploying Raw Buffer Version (v4.0.0)
echo ===========================================
echo.

cd /d "C:\Users\user\line-booking-system"

echo Step 1: Deploying with Secrets...
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
  --update-secrets ^
    LINE_CHANNEL_SECRET=line-channel-secret:latest,^
    LINE_CHANNEL_ACCESS_TOKEN=line-channel-access-token:latest,^
    SUPABASE_URL=supabase-url:latest,^
    SUPABASE_ANON_KEY=supabase-anon-key:latest ^
  --quiet

echo.
echo Step 2: Verifying deployment...
gcloud run services describe line-booking-api --region asia-northeast1 --format="value(status.url)" --project line-booking-system

echo.
echo Step 3: Testing version endpoint...
curl -s https://line-booking-api-116429620992.asia-northeast1.run.app/api/version

echo.
echo.
echo ===========================================
echo Deployment complete!
echo ===========================================
echo.
pause