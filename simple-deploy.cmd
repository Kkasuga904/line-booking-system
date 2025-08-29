@echo off
cd /d C:\Users\user\line-booking-system
call gcloud run deploy line-booking-api --source . --region asia-northeast1 --allow-unauthenticated --project line-booking-system
pause