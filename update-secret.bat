@echo off
echo Updating LINE Channel Secret...
echo.

echo 95909cf238912a222f05e0bbe636e70c | gcloud secrets versions add line-channel-secret --data-file=-

echo.
echo Updating Cloud Run service...
echo.

gcloud run services update line-booking-api --region asia-northeast1 --update-secrets=LINE_CHANNEL_SECRET=line-channel-secret:latest

echo.
echo Done! Wait 1-2 minutes for the service to restart.
echo Then test with LINE app by sending "予約"
echo.
pause