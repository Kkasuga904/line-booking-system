@echo off
chcp 65001 >nul
echo ========================================
echo Service Health Check
echo ========================================
echo.

set GCLOUD=C:\Users\user\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd
set PROJECT_ID=line-booking-prod-20241228

echo Checking service status...
"%GCLOUD%" run services describe line-booking-api --region asia-northeast1 --project %PROJECT_ID% --format="value(status.url)"

echo.
echo Testing endpoints:
echo.

echo 1. Health check:
curl -s https://line-booking-api-116429620992.asia-northeast1.run.app/api/health
echo.
echo.

echo 2. Root path:
curl -s -o nul -w "Status: %%{http_code}\n" https://line-booking-api-116429620992.asia-northeast1.run.app/
echo.

echo 3. Admin page (main URL):
curl -s -o nul -w "Status: %%{http_code}\n" https://line-booking-api-116429620992.asia-northeast1.run.app/admin-full-featured.html
echo.

echo 4. Admin page (store-a URL):
curl -s -o nul -w "Status: %%{http_code}\n" https://store-a---line-booking-api-116429620992.asia-northeast1.run.app/admin-full-featured.html
echo.

echo 5. API test:
curl -s https://line-booking-api-116429620992.asia-northeast1.run.app/api/capacity-status?store_id=store-a
echo.
echo.

echo ========================================
echo Checking recent logs for errors...
echo ========================================
"%GCLOUD%" logging read "resource.type=cloud_run_revision AND severity>=ERROR" --limit=5 --project=%PROJECT_ID% --format="table(timestamp,textPayload)"

pause