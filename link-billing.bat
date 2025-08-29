@echo off
echo ========================================
echo GCP 請求先リンク実行
echo ========================================
echo.

set PROJECT_ID=line-booking-prod-20241228
set BILLING_ID=019EA0-5ADC1A-03FBAA

echo プロジェクト: %PROJECT_ID%
echo 請求先ID: %BILLING_ID%
echo.

echo Step 1: プロジェクトと請求先をリンク
echo ----------------------------------------
gcloud billing projects link %PROJECT_ID% --billing-account=%BILLING_ID%

echo.
echo Step 2: 必要なAPIを有効化
echo ----------------------------------------
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable cloudbuild.googleapis.com

echo.
echo Step 3: シークレット作成
echo ----------------------------------------
echo LINE_CHANNEL_ACCESS_TOKEN設定...
echo 2l2dPaFJzJm9dOGWUDWjSkTd4q6rPFCQyNlJCsjroXvp8ms5ixN5y5wLaWkdL7yvbjGhrREmcrINg4sT+8/nKhExKuolhDSfddrgv9ZNqHwamM43ELsG51/IVWsdaRTxnAyRHCj6+pdQrhQmnw1f/wdB04t89/1O/w1cDnyilFU= | gcloud secrets create line-channel-access-token --data-file=- 2>nul

echo LINE_CHANNEL_SECRET設定...
echo c093c9b8e2c2e80ce48f039e6833f636 | gcloud secrets create line-channel-secret --data-file=- 2>nul

echo SUPABASE_URL設定...
echo https://faenvzzeguvlconvrqgp.supabase.co | gcloud secrets create supabase-url --data-file=- 2>nul

echo SUPABASE_ANON_KEY設定...
echo eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8 | gcloud secrets create supabase-anon-key --data-file=- 2>nul

echo.
echo Step 4: Cloud Runデプロイ
echo ----------------------------------------
cd /d C:\Users\user\line-booking-system
gcloud run deploy line-booking-api ^
  --source . ^
  --region asia-northeast1 ^
  --platform managed ^
  --allow-unauthenticated ^
  --min-instances 0 ^
  --max-instances 10 ^
  --cpu 1 ^
  --memory 512Mi ^
  --timeout 60 ^
  --update-secrets=LINE_CHANNEL_ACCESS_TOKEN=line-channel-access-token:latest,LINE_CHANNEL_SECRET=line-channel-secret:latest,SUPABASE_URL=supabase-url:latest,SUPABASE_ANON_KEY=supabase-anon-key:latest ^
  --set-env-vars=NODE_ENV=production,STORE_ID=default-store,LIFF_ID=2006487876-xd1A5qJB

echo.
echo ========================================
echo デプロイ完了！
echo ========================================
echo.

for /f "tokens=*" %%i in ('gcloud run services describe line-booking-api --region asia-northeast1 --format "value(status.url)"') do set SERVICE_URL=%%i
echo Service URL: %SERVICE_URL%
echo Webhook URL: %SERVICE_URL%/webhook
echo.
echo LINE Developersに設定してください！
echo.
pause