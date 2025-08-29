@echo off
echo Checking Cloud Run logs...
echo.
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=line-booking-api" --limit 20 --format="table(timestamp,jsonPayload.message,jsonPayload.error)"
pause