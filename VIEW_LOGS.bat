@echo off
chcp 65001 >nul
echo ========================================
echo View Cloud Run Logs
echo ========================================
echo.

set GCLOUD=C:\Users\user\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd
set PROJECT_ID=line-booking-prod-20241228

if not exist "%GCLOUD%" (
    echo ERROR: gcloud not found
    pause
    exit /b 1
)

echo Select log type:
echo 1. All logs (real-time)
echo 2. Error logs only
echo 3. Store-a logs
echo 4. Recent errors (last 10)
echo.
set /p CHOICE=Enter choice (1-4): 

if "%CHOICE%"=="1" (
    echo.
    echo Showing all logs... (Press Ctrl+C to stop)
    echo ----------------------------------------
    "%GCLOUD%" logging tail "resource.type=cloud_run_revision" --project=%PROJECT_ID%
) else if "%CHOICE%"=="2" (
    echo.
    echo Showing error logs... (Press Ctrl+C to stop)
    echo ----------------------------------------
    "%GCLOUD%" logging tail "resource.type=cloud_run_revision AND severity>=ERROR" --project=%PROJECT_ID%
) else if "%CHOICE%"=="3" (
    echo.
    echo Showing store-a logs... (Press Ctrl+C to stop)
    echo ----------------------------------------
    "%GCLOUD%" logging tail "resource.type=cloud_run_revision AND jsonPayload.store_id=store-a" --project=%PROJECT_ID%
) else if "%CHOICE%"=="4" (
    echo.
    echo Recent errors:
    echo ----------------------------------------
    "%GCLOUD%" logging read "resource.type=cloud_run_revision AND severity>=ERROR" --limit=10 --project=%PROJECT_ID% --format=json
) else (
    echo Invalid choice
)

echo.
pause