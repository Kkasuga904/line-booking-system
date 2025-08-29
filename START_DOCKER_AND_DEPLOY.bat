@echo off
echo ========================================
echo Docker起動 & 自動デプロイ
echo ========================================
echo.

REM Docker Desktop起動
echo Docker Desktopを起動中...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

echo Docker Desktopが起動するまで待機中（30秒）...
timeout /t 30 /nobreak >nul

echo.
echo Docker起動確認中...
:CHECK_DOCKER
docker version >nul 2>&1
if errorlevel 1 (
    echo Dockerがまだ起動していません。10秒後に再確認...
    timeout /t 10 /nobreak >nul
    goto CHECK_DOCKER
)

echo ✅ Docker Desktop起動完了！
echo.

REM デプロイスクリプトを実行
call deploy-with-docker.bat