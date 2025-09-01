@echo off
chcp 65001 >nul
echo ========================================
echo Fixing 404 Error - Checking Service
echo ========================================
echo.

set GCLOUD=C:\Users\user\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd
set PROJECT_ID=line-booking-prod-20241228

echo Current service URL:
"%GCLOUD%" run services describe line-booking-api --region asia-northeast1 --project %PROJECT_ID% --format="value(status.url)"
echo.

echo ========================================
echo Testing different URLs:
echo ========================================
echo.

echo 1. Main service URL (should work):
curl -s -o nul -w "Status: %%{http_code}\n" https://line-booking-api-116429620992.asia-northeast1.run.app/
echo.

echo 2. Health API (should return JSON):
curl -s https://line-booking-api-116429620992.asia-northeast1.run.app/api/health
echo.
echo.

echo 3. Admin page (correct path):
curl -s -o nul -w "Status: %%{http_code}\n" https://line-booking-api-116429620992.asia-northeast1.run.app/admin-full-featured.html
echo.

echo 4. LIFF page:
curl -s -o nul -w "Status: %%{http_code}\n" https://line-booking-api-116429620992.asia-northeast1.run.app/liff-booking-enhanced.html
echo.

echo ========================================
echo The correct URLs to use:
echo ========================================
echo.
echo Admin Panel:
echo https://line-booking-api-116429620992.asia-northeast1.run.app/admin-full-featured.html
echo.
echo LIFF Booking:
echo https://line-booking-api-116429620992.asia-northeast1.run.app/liff-booking-enhanced.html
echo.
echo Seat Management:
echo https://line-booking-api-116429620992.asia-northeast1.run.app/admin-seat-management.html
echo.
echo Test Capacity:
echo https://line-booking-api-116429620992.asia-northeast1.run.app/test-capacity-visual.html
echo.
echo ========================================
echo Note: The store-a--- subdomain is just a tag,
echo use the main URL above instead.
echo ========================================
echo.
pause