@echo off
echo ========================================
echo 🚀 即座デプロイ - マルチテナント対応
echo ========================================
echo.

REM プロジェクトIDとリージョン設定
set PROJECT_ID=line-booking-prod-20241228
set REGION=asia-northeast1
set SERVICE_NAME=line-booking-api

echo ✅ 既存の認証情報を使用:
echo   - LINE Channel Secret: ***REMOVED-ROTATE-CREDENTIAL***
echo   - LINE Access Token: vvXAkqWwYjB...
echo   - LIFF ID: ***REMOVED-ROTATE-CREDENTIAL***
echo.

echo 📝 Step 1: シークレット作成（初回のみ）
echo ----------------------------------------

REM LINE Channel Secret (store-a用)
echo Creating line-channel-secret-store-a...
echo ***REMOVED-ROTATE-CREDENTIAL*** | gcloud secrets create line-channel-secret-store-a --data-file=- --project=%PROJECT_ID% 2>nul || echo Secret already exists

REM LINE Access Token (store-a用)
echo Creating line-access-token-store-a...
echo ***REMOVED-ROTATE-CREDENTIAL*** | gcloud secrets create line-access-token-store-a --data-file=- --project=%PROJECT_ID% 2>nul || echo Secret already exists

REM LIFF ID (store-a用) - 環境変数として設定
echo.
echo ✅ Secrets ready for store-a
echo.

echo 📦 Step 2: 設定検証
echo ----------------------------------------
node -e "const {loadValidatedConfig} = require('./utils/store-config-validated'); loadValidatedConfig('store-a').then(c => console.log('Config OK:', c.ui.storeName || 'store-a')).catch(e => console.error('Config Error:', e.message));"

echo.
echo 🚀 Step 3: カナリアデプロイ (10%% トラフィック)
echo ----------------------------------------
echo.

REM 環境変数設定
set ENV_VARS=STORE_ID=store-a,NODE_ENV=production
set ENV_VARS=%ENV_VARS%,SUPABASE_URL=***REMOVED-ROTATE-CREDENTIAL***
set ENV_VARS=%ENV_VARS%,LIFF_ID_STORE_A=***REMOVED-ROTATE-CREDENTIAL***

REM デプロイ実行
gcloud run deploy %SERVICE_NAME% ^
  --source . ^
  --region %REGION% ^
  --platform managed ^
  --allow-unauthenticated ^
  --set-env-vars="%ENV_VARS%" ^
  --update-secrets="LINE_CHANNEL_SECRET_STORE_A=line-channel-secret-store-a:latest" ^
  --update-secrets="LINE_CHANNEL_ACCESS_TOKEN_STORE_A=line-access-token-store-a:latest" ^
  --update-secrets="SUPABASE_ANON_KEY=supabase-anon-key:latest" ^
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
echo 🔄 Step 4: トラフィック設定 (10%%)
echo ----------------------------------------

REM 現在のリビジョンを取得
for /f "tokens=*" %%i in ('gcloud run services describe %SERVICE_NAME% --region %REGION% --project=%PROJECT_ID% --format="value(status.traffic[0].revisionName)"') do set CURRENT_REV=%%i

REM 10%のトラフィックを新バージョンへ
gcloud run services update-traffic %SERVICE_NAME% ^
  --region %REGION% ^
  --to-tags store-a-canary=10 ^
  --to-revisions %CURRENT_REV%=90 ^
  --project=%PROJECT_ID%

echo.
echo ========================================
echo ✅ デプロイ完了！
echo ========================================
echo.
echo 📊 次のステップ:
echo 1. スモークテスト実行:
echo    set STORE_ID=store-a
echo    npm run smoke-test
echo.
echo 2. ログ監視:
echo    gcloud logging tail "resource.type=cloud_run_revision AND jsonPayload.store_id=store-a" --project=%PROJECT_ID%
echo.
echo 3. メトリクス確認:
echo    https://console.cloud.google.com/run/detail/%REGION%/%SERVICE_NAME%/metrics?project=%PROJECT_ID%
echo.
echo 4. 問題なければ100%%へ:
echo    gcloud run services update-traffic %SERVICE_NAME% --to-tags store-a-canary=100 --region %REGION% --project=%PROJECT_ID%
echo.
echo 5. ロールバック（必要時）:
echo    gcloud run services update-traffic %SERVICE_NAME% --to-revisions %CURRENT_REV%=100 --region %REGION% --project=%PROJECT_ID%
echo.
echo ========================================

pause