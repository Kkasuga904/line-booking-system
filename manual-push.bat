@echo off
echo 手動でGitHubへプッシュします...
cd /d C:\Users\user\line-booking-vercel

echo GitHubユーザー名を入力してください:
set /p username=

echo リモートを設定...
git remote remove origin 2>nul
git remote add origin https://github.com/%username%/line-booking-system.git

echo コードをプッシュ...
git push -u origin main

echo 完了！
pause