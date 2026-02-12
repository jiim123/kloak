@echo off
REM Batch script to check GitHub token
REM Usage: scripts\check-env.cmd

echo Checking GitHub token...

if "%GITHUB_TOKEN%"=="" (
    echo ❌ GITHUB_TOKEN is NOT set
    echo.
    echo To set it, run:
    echo   set GITHUB_TOKEN=your_token_here
    echo.
    echo Or set it permanently in System Environment Variables
    exit /b 1
)

echo ✅ GITHUB_TOKEN is set
echo    Token preview: %GITHUB_TOKEN:~0,10%...
echo    Length: %GITHUB_TOKEN:~0,1% characters
echo.
echo Repository: kloakapp/kloak-clients
echo.
echo ⚠️  Note: Full token testing requires PowerShell or Node.js
echo    Run: node scripts\test-token.js
echo    Or: powershell -ExecutionPolicy Bypass -File scripts\check-env.ps1
