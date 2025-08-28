@echo off
echo === Vercel環境変数設定 ===
echo.

cd /d "%~dp0"

echo 環境変数を設定します...
echo.

REM Supabase設定
echo [1/6] SUPABASE_URL を設定中...
echo https://faenvzzeguvlconvrqgp.supabase.co | vercel env add SUPABASE_URL production --force

echo [2/6] SUPABASE_ANON_KEY を設定中...
echo eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8 | vercel env add SUPABASE_ANON_KEY production --force

REM LINE設定
echo [3/6] LINE_CHANNEL_ACCESS_TOKEN を設定中...
echo 5SENzIx5iEoUn0pzwfaHnGOiZ1VUIqVJtS/YEKdJrXHJ0KbOcL0hQe5XCHdlL9fRzuwyRXEbI0s5D0UWwXC+V4XZJX5xvW4DGySoXqFdPo5cxXnJy8tGKVLIdOGG/iBCkbL3BzXZ6+K4nXSGHU9TQQdB04t89/1O/w1cDnyilFU= | vercel env add LINE_CHANNEL_ACCESS_TOKEN production --force

echo [4/6] LINE_CHANNEL_SECRET を設定中...
echo c093c9b8e2c2e80ce48f039e6833f636 | vercel env add LINE_CHANNEL_SECRET production --force

echo [5/6] LIFF_ID を設定中...
echo 2006487876-xd1A5qJB | vercel env add LIFF_ID production --force

REM Store設定
echo [6/6] STORE_ID を設定中...
echo default-store | vercel env add STORE_ID production --force

echo.
echo ✅ 環境変数の設定が完了しました！
echo.
echo 次のコマンドでデプロイしてください:
echo   vercel --prod --force
echo.
pause