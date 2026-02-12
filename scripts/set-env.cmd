@echo off
REM Batch script to set environment variables for Windows CMD
REM Usage: scripts\set-env.cmd YOUR_TOKEN_HERE

if "%1"=="" (
    echo Error: Please provide your GitHub token
    echo Usage: scripts\set-env.cmd YOUR_TOKEN_HERE
    exit /b 1
)

set GITHUB_TOKEN=%1

echo ✅ GITHUB_TOKEN has been set for this CMD session
echo.
echo Now you can run: npm run release 1.0.0
echo.
echo Note: This only sets the variable for this session.
echo To make it permanent, add it to your system environment variables.
