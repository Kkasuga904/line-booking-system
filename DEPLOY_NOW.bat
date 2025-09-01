@echo off
chcp 65001 >nul
echo ========================================
echo LINE Booking System - Deploy to Cloud Run
echo ========================================
echo.

REM Set gcloud path directly
set GCLOUD=C:\Users\user\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd

REM Check if gcloud exists
if not exist "%GCLOUD%" (
    echo ERROR: gcloud not found at expected location
    echo Please run GoogleCloudSDKInstaller.exe from Desktop first
    pause
    exit /b 1
)

REM Project settings
set PROJECT_ID=line-booking-prod-20241228
set REGION=asia-northeast1
set SERVICE_NAME=line-booking-api

echo Using gcloud from: %GCLOUD%
echo Project: %PROJECT_ID%
echo Region: %REGION%
echo.

echo Step 1: Setting project...
"%GCLOUD%" config set project %PROJECT_ID%

echo.
echo Step 2: Creating secrets...

REM Create LINE secrets for store-a
echo Creating line-channel-secret-store-a...
echo 95909cf238912a222f05e0bbe636e70c| "%GCLOUD%" secrets create line-channel-secret-store-a --data-file=- --project=%PROJECT_ID% 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Created successfully
) else (
    echo Already exists
)

echo Creating line-access-token-store-a...
echo vvXAkqWwYjBty9Rcw9d8RcKi+K1EYcsMzAqIoPybunN+ad46yN1T0uzbpxQTfR0XbjGhrREmcrINg4sT+8/nKhExKuolhDSfddrgv9ZNqHwko1j1l03lXiaZQePWslsQSm4RkxE/RJuOTqFlYhzkRQdB04t89/1O/w1cDnyilFU=| "%GCLOUD%" secrets create line-access-token-store-a --data-file=- --project=%PROJECT_ID% 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Created successfully
) else (
    echo Already exists
)

echo.
echo Step 3: Deploying to Cloud Run...
echo.

cd /d C:\Users\user\line-booking-system

"%GCLOUD%" run deploy %SERVICE_NAME% ^
  --source . ^
  --region %REGION% ^
  --platform managed ^
  --allow-unauthenticated ^
  --set-env-vars "STORE_ID=store-a,NODE_ENV=production,SUPABASE_URL=https://faenvzzeguvlconvrqgp.supabase.co,SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUzNTIxMDksImV4cCI6MjA1MDkyODEwOX0.DhX6PDWkNjRydPDLRqKXk8Trh9EILrN7kLanFPLaYpk,LIFF_ID_STORE_A=2006487876-xd1A5qJB" ^
  --update-secrets "LINE_CHANNEL_SECRET_STORE_A=line-channel-secret-store-a:latest,LINE_CHANNEL_ACCESS_TOKEN_STORE_A=line-access-token-store-a:latest" ^
  --tag store-a ^
  --project %PROJECT_ID% ^
  --memory 512Mi ^
  --cpu 1 ^
  --min-instances 0 ^
  --max-instances 10

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Deployment failed
    pause
    exit /b 1
)

echo.
echo Step 4: Setting traffic to 100%%...
"%GCLOUD%" run services update-traffic %SERVICE_NAME% ^
  --to-tags store-a=100 ^
  --region %REGION% ^
  --project %PROJECT_ID%

echo.
echo ========================================
echo DEPLOYMENT SUCCESSFUL!
echo ========================================
echo.
echo Service URL:
echo https://line-booking-api-116429620992.asia-northeast1.run.app
echo.
echo Tagged URL (store-a):
echo https://store-a---line-booking-api-116429620992.asia-northeast1.run.app
echo.
echo Monitor logs:
echo "%GCLOUD%" logging tail "resource.type=cloud_run_revision" --project=%PROJECT_ID%
echo.
pause