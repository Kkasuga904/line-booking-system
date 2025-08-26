@echo off
cd /d C:\Users\user\line-booking-system
set STORE_ID=test-account-2
set STORE_NAME=テストアカウント2 - 予約システム2
set PORT=3002
set BASE_URL=http://localhost:3002
rem ここに2つ目のLINEアカウントの実際のトークンとシークレットを設定してください
set LINE_CHANNEL_ACCESS_TOKEN=ここに2つ目のLINEアカウントのチャネルアクセストークンを入力
set LINE_CHANNEL_SECRET=ここに2つ目のLINEアカウントのチャネルシークレットを入力
set FEATURES=booking,reminder,cancel

echo ==========================================
echo   テストアカウント2 起動中...
echo ==========================================
echo.
echo Store ID: %STORE_ID%
echo Store Name: %STORE_NAME%
echo Port: %PORT%
echo URL: %BASE_URL%
echo.

node store-instance-server.js