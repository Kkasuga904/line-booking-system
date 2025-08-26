@echo off
echo ==========================================
echo   LINE予約システム マルチテナント起動
echo ==========================================
echo.

REM テナントAを起動
echo [1/3] テナントA を起動中...
start cmd /k "set TENANT_ID=tenant-a&& set PORT=3001&& set LINE_CHANNEL_ACCESS_TOKEN=demo_token_a&& set LINE_CHANNEL_SECRET=demo_secret_a&& set WEBHOOK_PATH=/tenant-a/webhook&& node multi-tenant-server.js"

timeout /t 2 /nobreak > nul

REM テナントBを起動
echo [2/3] テナントB を起動中...
start cmd /k "set TENANT_ID=tenant-b&& set PORT=3002&& set LINE_CHANNEL_ACCESS_TOKEN=demo_token_b&& set LINE_CHANNEL_SECRET=demo_secret_b&& set WEBHOOK_PATH=/tenant-b/webhook&& node multi-tenant-server.js"

timeout /t 2 /nobreak > nul

REM テナントCを起動
echo [3/3] テナントC を起動中...
start cmd /k "set TENANT_ID=tenant-c&& set PORT=3003&& set LINE_CHANNEL_ACCESS_TOKEN=demo_token_c&& set LINE_CHANNEL_SECRET=demo_secret_c&& set WEBHOOK_PATH=/tenant-c/webhook&& node multi-tenant-server.js"

timeout /t 3 /nobreak > nul

echo.
echo ==========================================
echo   全テナント起動完了！
echo ==========================================
echo.
echo アクセスURL:
echo   テナントA: http://localhost:3001/admin
echo   テナントB: http://localhost:3002/admin
echo   テナントC: http://localhost:3003/admin
echo.
echo Webhook URL (本番環境):
echo   テナントA: https://yourdomain.com/tenant-a/webhook
echo   テナントB: https://yourdomain.com/tenant-b/webhook
echo   テナントC: https://yourdomain.com/tenant-c/webhook
echo.
echo 停止するには各ウィンドウで Ctrl+C を押してください
echo ==========================================

pause