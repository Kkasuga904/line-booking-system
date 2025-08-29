# Cloud Run Deployment Script

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Cloud Run Deployment Starting..." -ForegroundColor Cyan  
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Move to project directory
Set-Location -Path "C:\Users\user\line-booking-system"

Write-Host "Deploying to Cloud Run..." -ForegroundColor Yellow
Write-Host "This will take 5-10 minutes..." -ForegroundColor Yellow
Write-Host ""

# Deploy to Cloud Run
gcloud run deploy line-booking-api `
  --source . `
  --region asia-northeast1 `
  --allow-unauthenticated `
  --min-instances 0 `
  --max-instances 10 `
  --memory 512Mi `
  --update-secrets="LINE_CHANNEL_ACCESS_TOKEN=line-channel-access-token:latest,LINE_CHANNEL_SECRET=line-channel-secret:latest,SUPABASE_URL=supabase-url:latest,SUPABASE_ANON_KEY=supabase-anon-key:latest" `
  --set-env-vars="NODE_ENV=production,STORE_ID=default-store,LIFF_ID=2006487876-xd1A5qJB"

# Get the service URL
$SERVICE_URL = gcloud run services describe line-booking-api --region asia-northeast1 --format "value(status.url)"

if ($SERVICE_URL) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  DEPLOYMENT SUCCESS!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Service URL: $SERVICE_URL" -ForegroundColor Cyan
    Write-Host "Webhook URL: $SERVICE_URL/webhook" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Copy the Webhook URL above" -ForegroundColor White
    Write-Host "2. Go to LINE Developers Console" -ForegroundColor White
    Write-Host "3. Update Webhook URL in Messaging API settings" -ForegroundColor White
    Write-Host "4. Test with LINE app by sending '予約'" -ForegroundColor White
    Write-Host ""
    
    # Test the health endpoint
    Write-Host "Testing health check..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "$SERVICE_URL/api/ping" -Method Get | Select-Object -ExpandProperty Content
} else {
    Write-Host "Error: Could not retrieve service URL" -ForegroundColor Red
    Write-Host "Check deployment status with:" -ForegroundColor Yellow
    Write-Host "gcloud run services list --region asia-northeast1" -ForegroundColor White
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")