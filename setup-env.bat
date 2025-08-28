@echo off
echo Setting up environment variables for Vercel...

REM LINE設定
vercel env add LIFF_ID production
vercel env add LINE_CHANNEL_ACCESS_TOKEN production  
vercel env add LINE_CHANNEL_SECRET production

REM Supabase設定
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production

REM Store設定
vercel env add STORE_ID production

echo Environment variables setup complete!
echo Please enter the values when prompted.
pause