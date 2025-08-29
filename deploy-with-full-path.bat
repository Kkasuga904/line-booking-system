@echo off
echo Deployment with full gcloud path
echo.

cd /d "C:\Users\user\line-booking-system"

REM Try different possible gcloud locations
if exist "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" (
    "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" run deploy line-booking-api --source . --region asia-northeast1 --allow-unauthenticated --project line-booking-system
) else if exist "C:\Program Files\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" (
    "C:\Program Files\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" run deploy line-booking-api --source . --region asia-northeast1 --allow-unauthenticated --project line-booking-system
) else if exist "%LOCALAPPDATA%\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" (
    "%LOCALAPPDATA%\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" run deploy line-booking-api --source . --region asia-northeast1 --allow-unauthenticated --project line-booking-system
) else (
    echo ERROR: gcloud not found in standard locations
    echo.
    echo Please run this command manually in PowerShell:
    echo   cd C:\Users\user\line-booking-system
    echo   gcloud run deploy line-booking-api --source . --region asia-northeast1 --allow-unauthenticated --project line-booking-system
)

echo.
pause