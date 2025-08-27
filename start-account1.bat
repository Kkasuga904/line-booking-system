@echo off
cd /d C:\Users\user\line-booking-system
set STORE_ID=test-account-1
set STORE_NAME=Store Instance 1
set PORT=3001
set BASE_URL=http://localhost:3001
rem ここに1つ目のLINEアカウントの実際のトークンとシークレットを設定してください
set LINE_CHANNEL_ACCESS_TOKEN=ここに1つ目のLINEアカウントのチャネルアクセストークンを入力
set LINE_CHANNEL_SECRET=ここに1つ目のLINEアカウントのチャネルシークレットを入力
set FEATURES=booking,reminder,cancel,reschedule

echo ==========================================
echo   Store Instance 1 起動中...
echo ==========================================
echo.
echo Store ID: %STORE_ID%
echo Store Name: %STORE_NAME%
echo Port: %PORT%
echo URL: %BASE_URL%
echo.

node store-instance-server.js