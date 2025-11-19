@echo off
REM Unit Scraper - Windows Launcher
REM Double-click to run

cd /d "%~dp0"

echo ================================================================
echo   Training.gov.au Unit Scraper - Auto Setup ^& Run
echo ================================================================
echo.

REM Check if node is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] ERROR: Node.js is not installed!
    echo [i] Please install Node.js from https://nodejs.org/
    echo     Minimum version: v18 or higher
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js detected: %NODE_VERSION%
echo.

REM Check if Units.xlsx exists
if not exist "Units.xlsx" (
    echo [X] ERROR: Units.xlsx not found in current directory!
    echo [i] Please place Units.xlsx in the same folder as this script.
    echo.
    pause
    exit /b 1
)

echo [OK] Found Units.xlsx
echo.

REM Auto-install dependencies if needed
if not exist "node_modules" (
    echo [i] Installing dependencies (first time only)...
    echo     This may take 1-2 minutes...
    echo.
    call npm install --silent
    if %ERRORLEVEL% NEQ 0 (
        echo [X] Failed to install dependencies!
        echo     Please check your internet connection and try again.
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed successfully!
    echo.
)

REM Create data directory if it doesn't exist
if not exist "data" (
    echo [i] Creating data directory...
    mkdir data
    echo [OK] Data directory created
    echo.
)

REM Run the scraper
echo [i] Starting scraper...
echo.
call npx tsx src/autoSync.ts

echo.
echo ================================================================
REM Keep window open
pause
