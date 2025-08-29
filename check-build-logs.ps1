# Check Cloud Build Logs

Write-Host "Checking recent build logs..." -ForegroundColor Yellow
Write-Host ""

# Get the latest build ID
$builds = gcloud builds list --limit=1 --region=asia-northeast1 --format="value(id)"

if ($builds) {
    Write-Host "Latest Build ID: $builds" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Build logs:" -ForegroundColor Yellow
    gcloud builds log $builds --region=asia-northeast1
} else {
    Write-Host "No builds found. Checking alternative method..." -ForegroundColor Yellow
    gcloud logging read "resource.type=cloud_build" --limit=50 --format="table(timestamp,textPayload)"
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")