@echo off
echo ==========================================
echo   LINE予約システム 2アカウント検証環境
echo ==========================================
echo.

REM 現在起動中のNode.jsを停止
echo 既存のプロセスを停止中...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak > nul

REM アカウント1を起動
echo [1/2] Store Instance 1 を起動中...
start "Account1" cmd /k "cd /d %~dp0 && set STORE_ID=test-account-1&& set STORE_NAME=Store Instance 1&& set PORT=3001&& set BASE_URL=http://localhost:3001&& set LINE_CHANNEL_ACCESS_TOKEN=dummy_token_1&& set LINE_CHANNEL_SECRET=dummy_secret_1&& node store-instance-server.js"

timeout /t 3 /nobreak > nul

REM アカウント2を起動
echo [2/2] Store Instance 2 を起動中...
start "Account2" cmd /k "cd /d %~dp0 && set STORE_ID=test-account-2&& set STORE_NAME=Store Instance 2&& set PORT=3002&& set BASE_URL=http://localhost:3002&& set LINE_CHANNEL_ACCESS_TOKEN=dummy_token_2&& set LINE_CHANNEL_SECRET=dummy_secret_2&& node store-instance-server.js"

timeout /t 3 /nobreak > nul

echo.
echo ==========================================
echo   起動完了！
echo ==========================================
echo.
echo 【アカウント1】
echo   URL: http://localhost:3001
echo   Webhook: http://localhost:3001/webhook
echo   管理画面: http://localhost:3001/admin
echo.
echo 【アカウント2】
echo   URL: http://localhost:3002
echo   Webhook: http://localhost:3002/webhook
echo   管理画面: http://localhost:3002/admin
echo.
echo ==========================================
echo LINE Developers Consoleで設定:
echo.
echo アカウント1のWebhook URL:
echo   ローカル: http://localhost:3001/webhook
echo   本番: https://your-domain1.com/webhook
echo.
echo アカウント2のWebhook URL:
echo   ローカル: http://localhost:3002/webhook
echo   本番: https://your-domain2.com/webhook
echo ==========================================
echo.
echo 停止するには各ウィンドウで Ctrl+C を押してください
echo.

REM ブラウザで両方開く
timeout /t 2 /nobreak > nul
start http://localhost:3001
start http://localhost:3002

pause