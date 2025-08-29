@echo off
echo Safe deployment script
echo.
cd /d "C:\Users\user\line-booking-system"
echo Current directory: %cd%
echo.
echo Starting deployment...
gcloud run deploy line-booking-api --source . --region asia-northeast1 --allow-unauthenticated --project line-booking-system
echo.
echo Deployment finished
pause