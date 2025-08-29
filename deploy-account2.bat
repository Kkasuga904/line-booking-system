@echo off
echo ========================================
echo    Deploy Second Account to Cloud Run
echo ========================================
echo.

echo Note: You need to create a second LINE Bot and get new tokens
echo.

set SERVICE_NAME=line-booking-api-account2
set PROJECT_ID=line-booking-prod-20241228
set REGION=asia-northeast1

echo Service: %SERVICE_NAME%
echo.

echo First, create secrets for account 2...
echo.

echo Enter LINE_CHANNEL_ACCESS_TOKEN for Account 2:
set /p TOKEN2=

echo Enter LINE_CHANNEL_SECRET for Account 2:
set /p SECRET2=

if "%TOKEN2%"=="" (
    echo Error: Token is required
    pause
    exit /b 1
)

if "%SECRET2%"=="" (
    echo Error: Secret is required
    pause
    exit /b 1
)

echo Creating secrets...
echo %TOKEN2% | gcloud secrets create line-channel-access-token-2 --data-file=- 2>nul
echo %SECRET2% | gcloud secrets create line-channel-secret-2 --data-file=- 2>nul

echo.
echo Deploying Account 2 to Cloud Run...
echo.

gcloud run deploy %SERVICE_NAME% ^
  --source . ^
  --region %REGION% ^
  --allow-unauthenticated ^
  --min-instances 0 ^
  --max-instances 5 ^
  --memory 512Mi ^
  --timeout 300 ^
  --port 8080 ^
  --update-secrets=LINE_CHANNEL_ACCESS_TOKEN=line-channel-access-token-2:latest,LINE_CHANNEL_SECRET=line-channel-secret-2:latest,SUPABASE_URL=supabase-url:latest,SUPABASE_ANON_KEY=supabase-anon-key:latest ^
  --set-env-vars=NODE_ENV=production,STORE_ID=test-account-2,STORE_NAME=テストアカウント2

echo.
for /f "tokens=*" %%i in ('gcloud run services describe %SERVICE_NAME% --region %REGION% --format "value(status.url)" 2^>nul') do set SERVICE_URL=%%i

if defined SERVICE_URL (
    echo ========================================
    echo    Account 2 Deployment Success!
    echo ========================================
    echo.
    echo Service URL: %SERVICE_URL%
    echo Webhook URL: %SERVICE_URL%/webhook
    echo.
    echo Update this URL in your second LINE Bot settings
) else (
    echo Deployment failed or in progress
)

echo.
pause