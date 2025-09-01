@echo off
chcp 65001 >nul
echo ========================================
echo Google Cloud SDK Setup
echo ========================================
echo.

REM Check Desktop for Google Cloud SDK installer
set GCLOUD_INSTALLER=%USERPROFILE%\Desktop\GoogleCloudSDKInstaller.exe

if exist "%GCLOUD_INSTALLER%" (
    echo Found SDK installer on Desktop
    echo.
    echo Running installer...
    "%GCLOUD_INSTALLER%"
    echo.
    echo After installation completes, run this script again
    pause
    exit /b 0
)

REM Check common installation paths
set GCLOUD_PATH=

if exist "%LOCALAPPDATA%\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" (
    set GCLOUD_PATH=%LOCALAPPDATA%\Google\Cloud SDK\google-cloud-sdk\bin
    echo Found in: %GCLOUD_PATH%
    goto :found
)

if exist "C:\Program Files\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" (
    set GCLOUD_PATH=C:\Program Files\Google\Cloud SDK\google-cloud-sdk\bin
    echo Found in: %GCLOUD_PATH%
    goto :found
)

if exist "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" (
    set GCLOUD_PATH=C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin
    echo Found in: %GCLOUD_PATH%
    goto :found
)

echo Google Cloud SDK not found
echo.
echo Please install from Desktop installer or download from:
echo https://cloud.google.com/sdk/docs/install
pause
exit /b 1

:found
echo.
echo Testing gcloud command...
"%GCLOUD_PATH%\gcloud.cmd" version

echo.
echo Setting project...
"%GCLOUD_PATH%\gcloud.cmd" config set project line-booking-prod-20241228

echo.
echo Checking authentication...
"%GCLOUD_PATH%\gcloud.cmd" auth list

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo gcloud path: %GCLOUD_PATH%
echo.
echo To use gcloud commands, use:
echo "%GCLOUD_PATH%\gcloud.cmd" [command]
echo.
pause