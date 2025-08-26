@echo off
echo ==========================================
echo   LINE予約システム 2アカウント同時起動
echo ==========================================
echo.
echo 注意: LINE_CHANNEL_ACCESS_TOKEN と LINE_CHANNEL_SECRET を
echo       実際の値に変更してから実行してください
echo.
pause

REM ===== アカウント1の設定 =====
REM 既存のLINEアカウントのトークンとシークレットをここに設定
set ACCOUNT1_TOKEN=ここに1つ目のLINEアカウントのアクセストークンを入力
set ACCOUNT1_SECRET=ここに1つ目のLINEアカウントのシークレットを入力

REM ===== アカウント2の設定 =====
REM 新しいLINEアカウントのトークンとシークレットをここに設定
set ACCOUNT2_TOKEN=ここに2つ目のLINEアカウントのアクセストークンを入力
set ACCOUNT2_SECRET=ここに2つ目のLINEアカウントのシークレットを入力

REM アカウント1起動
echo.
echo [1/2] 予約システム1 を起動中...
start "予約システム1" cmd /k "cd /d %~dp0 && set STORE_ID=account-1&& set STORE_NAME=予約システム1&& set PORT=3001&& set BASE_URL=http://localhost:3001&& set LINE_CHANNEL_ACCESS_TOKEN=%ACCOUNT1_TOKEN%&& set LINE_CHANNEL_SECRET=%ACCOUNT1_SECRET%&& set FEATURES=booking,reminder,cancel,reschedule&& node store-instance-server.js"

timeout /t 3 /nobreak > nul

REM アカウント2起動
echo [2/2] 予約システム2 を起動中...
start "予約システム2" cmd /k "cd /d %~dp0 && set STORE_ID=account-2&& set STORE_NAME=予約システム2&& set PORT=3002&& set BASE_URL=http://localhost:3002&& set LINE_CHANNEL_ACCESS_TOKEN=%ACCOUNT2_TOKEN%&& set LINE_CHANNEL_SECRET=%ACCOUNT2_SECRET%&& set FEATURES=booking,reminder,cancel&& node store-instance-server.js"

timeout /t 3 /nobreak > nul

echo.
echo ==========================================
echo   起動完了！
echo ==========================================
echo.
echo 【予約システム1】
echo   URL: http://localhost:3001
echo   Webhook URL: http://localhost:3001/webhook
echo   管理画面: http://localhost:3001/admin
echo.
echo 【予約システム2】
echo   URL: http://localhost:3002
echo   Webhook URL: http://localhost:3002/webhook
echo   管理画面: http://localhost:3002/admin
echo.
echo ==========================================
echo.
echo LINE Developers Consoleで各Webhook URLを設定してください
echo.
echo ngrokを使う場合:
echo   ngrok http 3001  (アカウント1用)
echo   ngrok http 3002  (アカウント2用、別ターミナル)
echo.
echo ==========================================
echo.

REM ブラウザで両方開く
start http://localhost:3001
start http://localhost:3002

pause