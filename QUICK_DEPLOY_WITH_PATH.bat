@echo off
echo ========================================
echo 🚀 即座デプロイ（gcloudパス自動設定付き）
echo ========================================
echo.

REM gcloudのパスを設定
set GCLOUD_CMD=gcloud

REM gcloudが見つからない場合は直接パスを指定
where gcloud >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo gcloud not in PATH, searching...
    if exist "C:\Users\%USERNAME%\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" (
        set GCLOUD_CMD="C:\Users\%USERNAME%\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
        echo Found: AppData
    ) else if exist "%USERPROFILE%\Desktop\google-cloud-sdk\bin\gcloud.cmd" (
        set GCLOUD_CMD="%USERPROFILE%\Desktop\google-cloud-sdk\bin\gcloud.cmd"
        echo Found: Desktop
    ) else if exist "C:\Program Files\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" (
        set GCLOUD_CMD="C:\Program Files\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
        echo Found: Program Files
    ) else (
        echo ❌ Google Cloud SDK が見つかりません！
        echo インストールしてください: https://cloud.google.com/sdk/docs/install
        pause
        exit /b 1
    )
)

REM プロジェクトIDとリージョン設定
set PROJECT_ID=line-booking-prod-20241228
set REGION=asia-northeast1
set SERVICE_NAME=line-booking-api

echo ✅ 使用するgcloud: %GCLOUD_CMD%
echo.

echo 📝 Step 1: プロジェクト設定
echo ----------------------------------------
%GCLOUD_CMD% config set project %PROJECT_ID%

echo.
echo 🔑 Step 2: シークレット作成（初回のみ）
echo ----------------------------------------

REM LINE Channel Secret (store-a用)
echo Creating line-channel-secret-store-a...
echo ***REMOVED-ROTATE-CREDENTIAL*** | %GCLOUD_CMD% secrets create line-channel-secret-store-a --data-file=- --project=%PROJECT_ID% 2>nul || echo Secret already exists

REM LINE Access Token (store-a用)
echo Creating line-access-token-store-a...
echo ***REMOVED-ROTATE-CREDENTIAL*** | %GCLOUD_CMD% secrets create line-access-token-store-a --data-file=- --project=%PROJECT_ID% 2>nul || echo Secret already exists

REM Supabase Service Role Key (既存のものを使用)
echo Checking supabase-service-role-key...
%GCLOUD_CMD% secrets describe supabase-service-role-key --project=%PROJECT_ID% >nul 2>&1 || (
    echo ⚠️ supabase-service-role-key が見つかりません
    echo 手動で作成してください:
    echo %GCLOUD_CMD% secrets create supabase-service-role-key --data-file=- --project=%PROJECT_ID%
)

echo.
echo ✅ Secrets ready for store-a
echo.

echo 📦 Step 3: 設定検証
echo ----------------------------------------
cd /d C:\Users\user\line-booking-system
node -e "const {loadValidatedConfig} = require('./utils/store-config-validated'); loadValidatedConfig('store-a').then(c => console.log('Config OK:', c.ui.storeName || 'store-a')).catch(e => console.error('Config Error:', e.message));" 2>nul || echo Config validation skipped

echo.
echo 🚀 Step 4: デプロイ実行（10%% トラフィック）
echo ----------------------------------------
echo.

REM 環境変数設定
set ENV_VARS=STORE_ID=store-a,NODE_ENV=production
set ENV_VARS=%ENV_VARS%,SUPABASE_URL=***REMOVED-ROTATE-CREDENTIAL***
set ENV_VARS=%ENV_VARS%,SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUzNTIxMDksImV4cCI6MjA1MDkyODEwOX0.DhX6PDWkNjRydPDLRqKXk8Trh9EILrN7kLanFPLaYpk
set ENV_VARS=%ENV_VARS%,LIFF_ID_STORE_A=***REMOVED-ROTATE-CREDENTIAL***

REM デプロイ実行
echo Deploying to Cloud Run...
%GCLOUD_CMD% run deploy %SERVICE_NAME% ^
  --source . ^
  --region %REGION% ^
  --platform managed ^
  --allow-unauthenticated ^
  --set-env-vars="%ENV_VARS%" ^
  --update-secrets="LINE_CHANNEL_SECRET_STORE_A=line-channel-secret-store-a:latest" ^
  --update-secrets="LINE_CHANNEL_ACCESS_TOKEN_STORE_A=line-access-token-store-a:latest" ^
  --update-secrets="SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest" ^
  --tag=store-a-canary ^
  --project=%PROJECT_ID% ^
  --memory=512Mi ^
  --cpu=1 ^
  --min-instances=0 ^
  --max-instances=10

if %ERRORLEVEL% NEQ 0 (
  echo ❌ デプロイ失敗
  pause
  exit /b 1
)

echo.
echo 🔄 Step 5: トラフィック設定（10%%）
echo ----------------------------------------

REM 現在のリビジョンを取得
for /f "tokens=*" %%i in ('%GCLOUD_CMD% run services describe %SERVICE_NAME% --region %REGION% --project=%PROJECT_ID% --format="value(status.traffic[0].revisionName)" 2^>nul') do set CURRENT_REV=%%i

if "%CURRENT_REV%"=="" (
    echo ⚠️ 既存のリビジョンが見つかりません。100%%でデプロイします。
    %GCLOUD_CMD% run services update-traffic %SERVICE_NAME% ^
      --region %REGION% ^
      --to-tags store-a-canary=100 ^
      --project=%PROJECT_ID%
) else (
    echo 現在のリビジョン: %CURRENT_REV%
    %GCLOUD_CMD% run services update-traffic %SERVICE_NAME% ^
      --region %REGION% ^
      --to-tags store-a-canary=10 ^
      --to-revisions %CURRENT_REV%=90 ^
      --project=%PROJECT_ID%
)

echo.
echo ========================================
echo ✅ デプロイ完了！
echo ========================================
echo.
echo 📊 次のステップ:
echo.
echo 1. ログ監視（新しいコマンドプロンプトで実行）:
echo    %GCLOUD_CMD% logging tail "resource.type=cloud_run_revision AND jsonPayload.store_id=store-a" --project=%PROJECT_ID%
echo.
echo 2. ダッシュボード確認:
echo    https://console.cloud.google.com/run/detail/%REGION%/%SERVICE_NAME%/metrics?project=%PROJECT_ID%
echo.
echo 3. 直接アクセステスト:
echo    curl https://store-a-canary---line-booking-api-116429620992.asia-northeast1.run.app/api/health
echo.
echo 4. トラフィックを増やす（30%%）:
echo    %GCLOUD_CMD% run services update-traffic %SERVICE_NAME% --to-tags store-a-canary=30 --region %REGION% --project=%PROJECT_ID%
echo.
echo 5. 100%%に切り替え:
echo    %GCLOUD_CMD% run services update-traffic %SERVICE_NAME% --to-tags store-a-canary=100 --region %REGION% --project=%PROJECT_ID%
echo.
echo 6. ロールバック（必要時）:
echo    %GCLOUD_CMD% run services update-traffic %SERVICE_NAME% --to-revisions %CURRENT_REV%=100 --region %REGION% --project=%PROJECT_ID%
echo.
echo ========================================

pause