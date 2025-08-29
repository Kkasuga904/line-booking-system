# PowerShell deployment script
Write-Host "Starting deployment..." -ForegroundColor Green
Set-Location "C:\Users\user\line-booking-system"

try {
    # Check if gcloud is available
    $gcloudPath = Get-Command gcloud -ErrorAction SilentlyContinue
    
    if ($gcloudPath) {
        Write-Host "Found gcloud at: $($gcloudPath.Path)" -ForegroundColor Cyan
        
        Write-Host "`nDeploying to Cloud Run..." -ForegroundColor Yellow
        gcloud run deploy line-booking-api `
            --source . `
            --region asia-northeast1 `
            --allow-unauthenticated `
            --project line-booking-system
            
        Write-Host "`nDeployment complete!" -ForegroundColor Green
        
        # Test the deployment
        Write-Host "`nTesting API version..." -ForegroundColor Yellow
        $response = Invoke-WebRequest -Uri "https://line-booking-api-116429620992.asia-northeast1.run.app/api/version" -UseBasicParsing
        Write-Host $response.Content -ForegroundColor Cyan
    } else {
        Write-Host "ERROR: gcloud command not found!" -ForegroundColor Red
        Write-Host "Please ensure Google Cloud SDK is installed and in PATH" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error occurred: $_" -ForegroundColor Red
}

Write-Host "`nPress any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")