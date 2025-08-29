@echo off
echo ========================================
echo GCP Billing Setup - 請求先設定
echo ========================================
echo.

set PROJECT_ID=line-booking-prod-20241228

echo Step 1: 請求先アカウント一覧確認
echo ----------------------------------------
gcloud billing accounts list
echo.

echo Step 2: 請求先アカウントがない場合は作成が必要です
echo ブラウザで開きます...
start https://console.cloud.google.com/billing/create?project=%PROJECT_ID%
echo.

echo Step 3: 請求先アカウントIDをコピーしてください
echo 形式: XXXXXX-XXXXXX-XXXXXX
echo.
set /p BILLING_ID=請求先アカウントID入力: 

if "%BILLING_ID%"=="" (
    echo エラー: 請求先IDが入力されていません
    pause
    exit /b 1
)

echo.
echo Step 4: プロジェクトと請求先をリンク
echo ----------------------------------------
gcloud billing projects link %PROJECT_ID% --billing-account=%BILLING_ID%

if %ERRORLEVEL% equ 0 (
    echo.
    echo 成功！請求先アカウントがリンクされました
    echo.
    echo Step 5: 必要なAPIを有効化
    echo ----------------------------------------
    gcloud services enable run.googleapis.com
    gcloud services enable artifactregistry.googleapis.com
    gcloud services enable secretmanager.googleapis.com
    gcloud services enable cloudbuild.googleapis.com
    echo.
    echo 完了！deploy-gcp.bat を再実行してください
) else (
    echo.
    echo エラー: 請求先リンクに失敗しました
    echo GCPコンソールで手動設定してください:
    echo https://console.cloud.google.com/billing/linkedaccount?project=%PROJECT_ID%
)

echo.
pause