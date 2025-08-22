@echo off
echo GitHubへプッシュします...
cd /d C:\Users\user\line-booking-vercel

echo リモートを設定...
git remote remove origin 2>nul
git remote add origin https://github.com/yourusername/line-booking-system.git

echo コードをプッシュ...
git push -u origin main

echo 完了！
pause