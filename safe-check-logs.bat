@echo off
echo Checking logs safely...
echo.

echo Testing API version:
curl -s https://line-booking-api-116429620992.asia-northeast1.run.app/api/version
echo.
echo.

echo Checking recent logs:
gcloud logging read "resource.type=cloud_run_revision" --limit 3 --project line-booking-system --format="table(timestamp,severity,jsonPayload.msg)"

echo.
echo Done!
pause