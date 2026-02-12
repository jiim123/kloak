# PowerShell script to check and set GitHub token
# Usage: .\scripts\check-env.ps1

Write-Host "Checking GitHub token..." -ForegroundColor Cyan

if ($env:GITHUB_TOKEN) {
    Write-Host "✅ GITHUB_TOKEN is set" -ForegroundColor Green
    Write-Host "   Token preview: $($env:GITHUB_TOKEN.Substring(0, [Math]::Min(10, $env:GITHUB_TOKEN.Length)))..." -ForegroundColor Gray
    Write-Host "   Length: $($env:GITHUB_TOKEN.Length) characters" -ForegroundColor Gray
} else {
    Write-Host "❌ GITHUB_TOKEN is NOT set" -ForegroundColor Red
    Write-Host ""
    Write-Host "To set it, run:" -ForegroundColor Yellow
    Write-Host '  $env:GITHUB_TOKEN="your_token_here"' -ForegroundColor White
    Write-Host ""
    Write-Host "Or set it permanently:" -ForegroundColor Yellow
    Write-Host "  [System.Environment]::SetEnvironmentVariable('GITHUB_TOKEN', 'your_token', 'User')" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "Checking repository..." -ForegroundColor Cyan

$repo = "kloakapp/kloak-clients"
Write-Host "   Repository: $repo" -ForegroundColor Gray

Write-Host ""
Write-Host "Testing token with GitHub API..." -ForegroundColor Cyan

$headers = @{
    "Authorization" = "Bearer $env:GITHUB_TOKEN"
    "Accept" = "application/vnd.github.v3+json"
}

try {
    $response = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo" -Headers $headers -Method Get
    Write-Host "✅ Token has access to repository!" -ForegroundColor Green
    Write-Host "   Repository: $($response.full_name)" -ForegroundColor Gray
    Write-Host "   Private: $($response.private)" -ForegroundColor Gray
    
    # Test releases endpoint
    Write-Host ""
    Write-Host "Testing releases endpoint..." -ForegroundColor Cyan
    $releasesResponse = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases" -Headers $headers -Method Get
    Write-Host "✅ Token can access releases!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 Your token is configured correctly!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now run: npm run release 1.0.0" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response.StatusCode -eq 403) {
        Write-Host ""
        Write-Host "⚠️  403 Forbidden - Token permissions issue:" -ForegroundColor Yellow
        Write-Host "   1. Go to https://github.com/settings/tokens" -ForegroundColor White
        Write-Host "   2. Make sure token has 'repo' scope (classic tokens)" -ForegroundColor White
        Write-Host "   3. Or 'Contents: Write' + 'Metadata: Read' (fine-grained tokens)" -ForegroundColor White
        Write-Host "   4. If repo is private, ensure token has access" -ForegroundColor White
    } elseif ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host ""
        Write-Host "⚠️  404 Not Found - Repository might not exist or token has no access" -ForegroundColor Yellow
    }
    exit 1
}
