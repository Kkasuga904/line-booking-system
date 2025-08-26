@echo off
echo ==========================================
echo   LINE予約システム - 店舗別起動
echo ==========================================
echo.

set /p STORE_ID="店舗IDを入力してください (例: store-001): "

if exist "stores\%STORE_ID%.env" (
    echo %STORE_ID% の設定を読み込み中...
    
    REM 環境変数ファイルから設定を読み込む
    for /f "tokens=1,2 delims==" %%a in (stores\%STORE_ID%.env) do (
        if not "%%a"=="" if not "%%b"=="" (
            REM コメント行をスキップ
            echo %%a | findstr /b "#" >nul
            if errorlevel 1 (
                set %%a=%%b
            )
        )
    )
    
    echo.
    echo ==========================================
    echo   起動中: %STORE_NAME%
    echo ==========================================
    echo.
    echo Store ID: %STORE_ID%
    echo URL: %BASE_URL%
    echo Webhook: %BASE_URL%/webhook
    echo 管理画面: %BASE_URL%/admin
    echo.
    
    node store-instance-server.js
) else (
    echo.
    echo エラー: stores\%STORE_ID%.env が見つかりません
    echo.
    echo 利用可能な店舗:
    dir /b stores\*.env 2>nul | findstr /r "store-.*\.env"
    echo.
    pause
)