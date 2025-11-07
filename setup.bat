@echo off
REM Automatic Setup Script for Windows
REM Ensures all dependencies and folders are created

echo ================================================================
echo   Training.gov.au Scraper - Initial Setup
echo ================================================================
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] Node.js is not installed!
    echo [i] Please install Node.js from https://nodejs.org/ (v18 or higher)
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js detected: %NODE_VERSION%

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo [OK] npm detected: %NPM_VERSION%
echo.

REM Install dependencies
echo [i] Installing dependencies...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo [X] Failed to install dependencies!
    pause
    exit /b 1
)

echo [OK] Dependencies installed successfully
echo.

REM Create data directory
echo [i] Creating data directory...
if not exist "data" mkdir data

echo [OK] Data directory created
echo.

echo ================================================================
echo [OK] Setup complete!
echo.
echo Next steps:
echo   1. Place your Units.xlsx file in this directory
echo   2. Double-click START.bat
echo ================================================================
echo.
pause
