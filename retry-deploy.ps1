# Retry Cloud Run Deployment

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Retrying Cloud Run Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .dockerignore exists
if (-not (Test-Path ".dockerignore")) {
    Write-Host "Creating .dockerignore file..." -ForegroundColor Yellow
    @"
node_modules
npm-debug.log
.env
.env.local
.env.prod
*.log
.git
.gitignore
README.md
*.md
.vscode
.idea
test
tests
coverage
.nyc_output
*.bat
*.ps1
*.sh
"@ | Out-File -FilePath ".dockerignore" -Encoding UTF8
}

Write-Host "Starting deployment..." -ForegroundColor Yellow
Write-Host ""

# Deploy with simplified configuration
gcloud run deploy line-booking-api `
  --source . `
  --region asia-northeast1 `
  --allow-unauthenticated `
  --min-instances 0 `
  --max-instances 10 `
  --memory 512Mi `
  --timeout 60 `
  --update-secrets="LINE_CHANNEL_ACCESS_TOKEN=line-channel-access-token:latest,LINE_CHANNEL_SECRET=line-channel-secret:latest,SUPABASE_URL=supabase-url:latest,SUPABASE_ANON_KEY=supabase-anon-key:latest" `
  --set-env-vars="NODE_ENV=production,STORE_ID=default-store"

$LASTEXITCODE_SAVE = $LASTEXITCODE

if ($LASTEXITCODE_SAVE -eq 0) {
    # Get service URL
    $SERVICE_URL = gcloud run services describe line-booking-api --region asia-northeast1 --format "value(status.url)"
    
    if ($SERVICE_URL) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  DEPLOYMENT SUCCESS!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Service URL: $SERVICE_URL" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Webhook URL for LINE Developers:" -ForegroundColor Yellow
        Write-Host "$SERVICE_URL/webhook" -ForegroundColor Green
        Write-Host ""
        Write-Host "Testing health endpoint..." -ForegroundColor Yellow
        try {
            $response = Invoke-WebRequest -Uri "$SERVICE_URL/api/ping" -Method Get -ErrorAction Stop
            Write-Host "Health check: OK" -ForegroundColor Green
        } catch {
            Write-Host "Health check failed (service may still be starting)" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host ""
    Write-Host "Deployment failed. Checking logs..." -ForegroundColor Red
    Write-Host ""
    gcloud logging read "resource.type=cloud_build" --limit=20 --format="table(timestamp,textPayload)"
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")