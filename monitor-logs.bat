@echo off
REM ========================================
REM Cloud Runログモニタリング
REM ========================================

echo.
echo ===== Cloud Run リアルタイムログ監視 =====
echo.
echo Ctrl+C で停止
echo.

set PROJECT_ID=line-booking-prod-20241228
set SERVICE_NAME=line-booking-api

gcloud config set project %PROJECT_ID% 2>nul

echo プロジェクト: %PROJECT_ID%
echo サービス: %SERVICE_NAME%
echo.
echo ログ監視開始...
echo ========================================
echo.

gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=%SERVICE_NAME%" --format="value(timestamp,jsonPayload.message,jsonPayload.error)"