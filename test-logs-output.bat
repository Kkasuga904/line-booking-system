@echo off
echo ========================================
echo Checking deployment and logs...
echo ========================================
echo.

echo 1. Current version:
curl -s https://line-booking-api-116429620992.asia-northeast1.run.app/api/version
echo.
echo.

echo 2. Recent errors (last 5):
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=line-booking-api AND severity>=ERROR" --limit 5 --format="table(timestamp,jsonPayload.msg)" --project line-booking-system

echo.
echo 3. Recent webhook logs (last 5):
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=line-booking-api AND jsonPayload.msg:'Webhook'" --limit 5 --format="table(timestamp,jsonPayload.msg,jsonPayload.hasSecret,jsonPayload.hasSignature,jsonPayload.hasBody)" --project line-booking-system

echo.
echo 4. Signature verification logs:
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=line-booking-api AND (jsonPayload.msg:'Invalid signature' OR jsonPayload.msg:'Signature verified')" --limit 5 --format="table(timestamp,jsonPayload.msg,jsonPayload.sig_head,jsonPayload.exp_head)" --project line-booking-system

echo.
echo ========================================
echo Output saved to: test-logs-result.txt
echo ========================================

pause > nul