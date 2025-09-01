@echo off
echo ========================================
echo 📊 ログ監視ツール
echo ========================================
echo.

REM gcloudのパスを設定
set GCLOUD_CMD=gcloud

REM gcloudが見つからない場合は直接パスを指定
where gcloud >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    if exist "C:\Users\%USERNAME%\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" (
        set GCLOUD_CMD="C:\Users\%USERNAME%\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
    ) else if exist "%USERPROFILE%\Desktop\google-cloud-sdk\bin\gcloud.cmd" (
        set GCLOUD_CMD="%USERPROFILE%\Desktop\google-cloud-sdk\bin\gcloud.cmd"
    ) else (
        echo ❌ Google Cloud SDK が見つかりません！
        pause
        exit /b 1
    )
)

set PROJECT_ID=line-booking-prod-20241228

echo 監視オプション:
echo 1. store-a のすべてのログ（リアルタイム）
echo 2. エラーログのみ
echo 3. 予約作成ログ
echo 4. 高レイテンシ（1秒以上）
echo 5. store_id が unknown のログ
echo 6. 最近のエラー（過去10件）
echo.
set /p OPTION=選択してください (1-6): 

if "%OPTION%"=="1" (
    echo.
    echo 📝 store-a のすべてのログを監視中... (Ctrl+C で終了)
    echo ----------------------------------------
    %GCLOUD_CMD% logging tail "resource.type=cloud_run_revision AND jsonPayload.store_id=store-a" --project=%PROJECT_ID%
) else if "%OPTION%"=="2" (
    echo.
    echo ❌ エラーログを監視中... (Ctrl+C で終了)
    echo ----------------------------------------
    %GCLOUD_CMD% logging tail "resource.type=cloud_run_revision AND severity>=ERROR AND jsonPayload.store_id=store-a" --project=%PROJECT_ID%
) else if "%OPTION%"=="3" (
    echo.
    echo 📅 予約作成ログを監視中... (Ctrl+C で終了)
    echo ----------------------------------------
    %GCLOUD_CMD% logging tail "resource.type=cloud_run_revision AND jsonPayload.msg=~'Reservation.*created' AND jsonPayload.store_id=store-a" --project=%PROJECT_ID%
) else if "%OPTION%"=="4" (
    echo.
    echo ⏱️ 高レイテンシリクエスト（過去20件）
    echo ----------------------------------------
    %GCLOUD_CMD% logging read "resource.type=cloud_run_revision AND jsonPayload.ms>1000 AND jsonPayload.store_id=store-a" --limit=20 --project=%PROJECT_ID% --format=json
) else if "%OPTION%"=="5" (
    echo.
    echo ⚠️ store_id が unknown のログ（過去10件）
    echo ----------------------------------------
    %GCLOUD_CMD% logging read "resource.type=cloud_run_revision AND jsonPayload.store_id=unknown" --limit=10 --project=%PROJECT_ID% --format=json
) else if "%OPTION%"=="6" (
    echo.
    echo ❌ 最近のエラー（過去10件）
    echo ----------------------------------------
    %GCLOUD_CMD% logging read "resource.type=cloud_run_revision AND severity>=ERROR" --limit=10 --project=%PROJECT_ID% --format=json
) else (
    echo 無効な選択です
)

echo.
pause