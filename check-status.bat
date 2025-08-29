@echo off
chcp 65001 >nul 2>&1
cls
echo ========================================
echo     CHECK DEPLOYMENT STATUS
echo ========================================
echo.

gcloud config set project line-booking-prod-20241228 >nul 2>&1

echo [1] Checking billing link...
gcloud billing projects describe line-booking-prod-20241228 2>nul | findstr "billingAccountName"
echo.

echo [2] Checking enabled APIs...
gcloud services list --enabled --filter="NAME:run.googleapis.com" --format="value(NAME)" 2>nul
echo.

echo [3] Checking Cloud Run service...
gcloud run services list --region asia-northeast1 --format="table(SERVICE,REGION,URL)" 2>nul
echo.

echo [4] Getting Service URL...
for /f "tokens=*" %%i in ('gcloud run services describe line-booking-api --region asia-northeast1 --format "value(status.url)" 2^>nul') do (
    echo.
    echo ========================================
    echo SUCCESS! Service is deployed!
    echo.
    echo Service URL: %%i
    echo Webhook URL: %%i/webhook
    echo ========================================
    echo.
    echo Copy this Webhook URL to LINE Developers!
)

pause