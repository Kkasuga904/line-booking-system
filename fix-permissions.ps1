# Fix Cloud Build Service Account Permissions

Write-Host "Fixing Cloud Build permissions..." -ForegroundColor Yellow

$PROJECT_ID = "line-booking-prod-20241228"
$PROJECT_NUMBER = "116429620992"

# Grant necessary permissions to Cloud Build service account
Write-Host "Granting Cloud Run Admin permission..." -ForegroundColor Cyan
gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" `
    --role="roles/run.admin"

Write-Host "Granting Service Account User permission..." -ForegroundColor Cyan
gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" `
    --role="roles/iam.serviceAccountUser"

Write-Host "Granting Secret Manager Accessor permission..." -ForegroundColor Cyan
gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" `
    --role="roles/secretmanager.secretAccessor"

Write-Host ""
Write-Host "Permissions fixed!" -ForegroundColor Green
Write-Host ""
Write-Host "Now retrying deployment..." -ForegroundColor Yellow
Write-Host ""

# Retry deployment
gcloud run deploy line-booking-api `
  --source . `
  --region asia-northeast1 `
  --allow-unauthenticated `
  --min-instances 0 `
  --max-instances 10 `
  --memory 512Mi `
  --update-secrets="LINE_CHANNEL_ACCESS_TOKEN=line-channel-access-token:latest,LINE_CHANNEL_SECRET=line-channel-secret:latest,SUPABASE_URL=supabase-url:latest,SUPABASE_ANON_KEY=supabase-anon-key:latest" `
  --set-env-vars="NODE_ENV=production,STORE_ID=default-store,LIFF_ID=2006487876-xd1A5qJB"

# Get service URL
$SERVICE_URL = gcloud run services describe line-booking-api --region asia-northeast1 --format "value(status.url)"

if ($SERVICE_URL) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  DEPLOYMENT SUCCESS!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Service URL: $SERVICE_URL" -ForegroundColor Cyan
    Write-Host "Webhook URL: $SERVICE_URL/webhook" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Copy this Webhook URL to LINE Developers!" -ForegroundColor White
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")