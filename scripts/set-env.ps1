# PowerShell script to set environment variables for Windows
# Usage: .\scripts\set-env.ps1

param(
    [Parameter(Mandatory=$true)]
    [string]$GitHubToken
)

# Set the GITHUB_TOKEN environment variable for the current session
$env:GITHUB_TOKEN = $GitHubToken

Write-Host "✅ GITHUB_TOKEN has been set for this PowerShell session" -ForegroundColor Green
Write-Host ""
Write-Host "Now you can run: npm run release 1.0.0" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: This only sets the variable for this session." -ForegroundColor Yellow
Write-Host "To make it permanent, add it to your system environment variables." -ForegroundColor Yellow
