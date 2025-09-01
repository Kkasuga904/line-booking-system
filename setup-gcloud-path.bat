@echo off
echo ========================================
echo 🔧 Google Cloud SDK パス設定
echo ========================================
echo.

REM Google Cloud SDKのパスを検索
set GCLOUD_PATH=

REM よくあるインストール場所をチェック
if exist "C:\Users\%USERNAME%\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" (
    set GCLOUD_PATH=C:\Users\%USERNAME%\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin
    echo ✅ Found in AppData: %GCLOUD_PATH%
)

if exist "C:\Program Files\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" (
    set GCLOUD_PATH=C:\Program Files\Google\Cloud SDK\google-cloud-sdk\bin
    echo ✅ Found in Program Files: %GCLOUD_PATH%
)

if exist "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" (
    set GCLOUD_PATH=C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin
    echo ✅ Found in Program Files (x86): %GCLOUD_PATH%
)

REM デスクトップもチェック
if exist "%USERPROFILE%\Desktop\google-cloud-sdk\bin\gcloud.cmd" (
    set GCLOUD_PATH=%USERPROFILE%\Desktop\google-cloud-sdk\bin
    echo ✅ Found on Desktop: %GCLOUD_PATH%
)

if "%GCLOUD_PATH%"=="" (
    echo ❌ Google Cloud SDK が見つかりません
    echo.
    echo 📥 インストール方法:
    echo 1. https://cloud.google.com/sdk/docs/install からダウンロード
    echo 2. インストーラーを実行
    echo 3. このバッチファイルを再実行
    pause
    exit /b 1
)

echo.
echo 🔄 環境変数PATHに追加しています...

REM 現在のセッションのPATHに追加
set PATH=%GCLOUD_PATH%;%PATH%

REM システム環境変数に永続的に追加
echo.
echo 永続的にPATHに追加しますか？ (Y/N)
set /p ADDPATH=

if /i "%ADDPATH%"=="Y" (
    setx PATH "%PATH%" /M 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo ⚠️ 管理者権限が必要です。以下のコマンドを管理者権限で実行してください:
        echo setx PATH "%GCLOUD_PATH%;%%PATH%%" /M
    ) else (
        echo ✅ システムPATHに追加しました
    )
)

echo.
echo 📋 gcloud バージョン確認...
"%GCLOUD_PATH%\gcloud.cmd" version

echo.
echo 🔑 認証状態確認...
"%GCLOUD_PATH%\gcloud.cmd" auth list

echo.
echo 📂 プロジェクト設定...
"%GCLOUD_PATH%\gcloud.cmd" config set project line-booking-prod-20241228

echo.
echo ========================================
echo ✅ セットアップ完了！
echo ========================================
echo.
echo 次のコマンドが使えるようになりました:
echo   gcloud --version
echo   gcloud auth login
echo   gcloud projects list
echo.
pause