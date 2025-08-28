@echo off
echo === Vercel環境変数設定 ===
echo.

cd /d "%~dp0"

echo 環境変数を設定します...
echo.

REM Supabase設定
echo [1/6] SUPABASE_URL を設定中...
echo ***REMOVED-ROTATE-CREDENTIAL*** | vercel env add SUPABASE_URL production --force

echo [2/6] SUPABASE_ANON_KEY を設定中...
echo ***REMOVED-ROTATE-CREDENTIAL*** | vercel env add SUPABASE_ANON_KEY production --force

REM LINE設定
echo [3/6] LINE_CHANNEL_ACCESS_TOKEN を設定中...
echo ***REMOVED-ROTATE-CREDENTIAL*** | vercel env add LINE_CHANNEL_ACCESS_TOKEN production --force

echo [4/6] LINE_CHANNEL_SECRET を設定中...
echo ***REMOVED-ROTATE-CREDENTIAL*** | vercel env add LINE_CHANNEL_SECRET production --force

echo [5/6] LIFF_ID を設定中...
echo ***REMOVED-ROTATE-CREDENTIAL*** | vercel env add LIFF_ID production --force

REM Store設定
echo [6/6] STORE_ID を設定中...
echo ***REMOVED-ROTATE-CREDENTIAL*** | vercel env add STORE_ID production --force

echo.
echo ✅ 環境変数の設定が完了しました！
echo.
echo 次のコマンドでデプロイしてください:
echo   vercel --prod --force
echo.
pause