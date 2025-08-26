@echo off
cd /d C:\Users\user\line-booking-system

set STORE_ID=account-2
set STORE_NAME=予約システム2
set PORT=3002
set BASE_URL=http://localhost:3002
set LINE_CHANNEL_ACCESS_TOKEN=ここに2つ目のアクセストークンを入力してください
set LINE_CHANNEL_SECRET=cd2213ae47341f3cd302eea78559e0f8
set FEATURES=booking,reminder,cancel

echo ==========================================
echo   予約システム2 起動中...
echo ==========================================
echo.
echo Store ID: %STORE_ID%
echo Store Name: %STORE_NAME%
echo Port: %PORT%
echo Webhook URL: %BASE_URL%/webhook
echo.
echo 注意: LINE_CHANNEL_ACCESS_TOKENを設定してください！
echo.

node store-instance-server.js