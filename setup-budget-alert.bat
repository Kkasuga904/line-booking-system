@echo off
REM ========================================
REM GCP予算アラート設定スクリプト
REM ========================================

echo.
echo ===== 予算アラート設定 =====
echo.

set PROJECT_ID=line-booking-prod-20241228

echo 現在のプロジェクト: %PROJECT_ID%
echo.

REM 請求先アカウント確認
echo [請求先アカウント一覧]
gcloud billing accounts list
echo.

echo 請求先アカウントID（例: 01234-56789-ABCDE）を入力してください:
set /p BILLING_ID=

if "%BILLING_ID%"=="" (
    echo エラー: 請求先アカウントIDが入力されていません
    pause
    exit /b 1
)

echo.
echo 設定内容:
echo - 請求先ID: %BILLING_ID%
echo - 1000円で50%%通知
echo - 1000円で90%%通知
echo - 1000円で100%%通知（上限到達）
echo - 3000円で100%%通知（追加アラート）
echo.
echo 続行しますか？ (Y/N)
set /p CONFIRM=

if /i "%CONFIRM%" neq "Y" (
    echo キャンセルしました
    pause
    exit /b 0
)

REM プロジェクトと請求先をリンク
echo.
echo [1/3] プロジェクトと請求先をリンク中...
gcloud billing projects link %PROJECT_ID% --billing-account=%BILLING_ID%

REM 1000円アラート作成
echo [2/3] 1000円予算アラート作成中...
gcloud billing budgets create ^
  --billing-account=%BILLING_ID% ^
  --display-name="LINE Booking 1000円アラート" ^
  --budget-amount=1000JPY ^
  --threshold-rule=percent=50 ^
  --threshold-rule=percent=90 ^
  --threshold-rule=percent=100 ^
  --filter-projects=projects/%PROJECT_ID%

REM 3000円アラート作成（安全装置）
echo [3/3] 3000円安全アラート作成中...
gcloud billing budgets create ^
  --billing-account=%BILLING_ID% ^
  --display-name="LINE Booking 3000円上限アラート" ^
  --budget-amount=3000JPY ^
  --threshold-rule=percent=100 ^
  --filter-projects=projects/%PROJECT_ID%

echo.
echo ✓ 予算アラート設定完了！
echo.
echo 設定内容:
echo - 1000円の50%%, 90%%, 100%%でメール通知
echo - 3000円到達で追加アラート
echo.
echo ※ 通知先メールアドレスはGCPコンソールで確認・変更できます
echo   https://console.cloud.google.com/billing/budgets
echo.
pause