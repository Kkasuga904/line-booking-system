@echo off
echo ========================================
echo  Safe Deployment Script for LINE Booking
echo ========================================
echo.

REM Run health checks first
echo Running pre-deployment health checks...
node health-check.js
if errorlevel 1 (
    echo.
    echo [ERROR] Health checks failed! Fix issues before deploying.
    pause
    exit /b 1
)

echo.
echo Health checks passed! Proceeding with deployment...
echo.

REM Deploy to both accounts
echo Deploying to booking-account1...
call "C:\Users\user\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" run deploy booking-account1 --source . --region asia-northeast1 --env-vars-file .env.yaml --allow-unauthenticated --port 8080 --memory 512Mi --cpu 1 --max-instances 2 --min-instances 0 --timeout 300 --quiet

echo.
echo Deploying to booking-account2...
call "C:\Users\user\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" run deploy booking-account2 --source . --region asia-northeast1 --env-vars-file .env.yaml --allow-unauthenticated --port 8080 --memory 512Mi --cpu 1 --max-instances 2 --min-instances 0 --timeout 300 --quiet

echo.
echo ========================================
echo  Deployment Complete!
echo ========================================
echo.
echo URLs:
echo - https://booking-account1-116429620992.asia-northeast1.run.app
echo - https://booking-account2-116429620992.asia-northeast1.run.app
echo.
pause