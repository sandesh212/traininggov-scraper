@echo off
REM FAST VALIDATOR - Uses Custom AI (2-3 seconds!)

cd /d "%~dp0"

echo ==========================================
echo   ⚡ FAST Assessment Validator
echo   Using Custom AI Engine
echo ==========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js first:
    echo   Visit: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo Node.js found
echo.
echo Starting fast validation...
echo ==========================================
echo.

REM Run the fast validator
cd .config
call npx tsx fast-test.ts

echo.
echo ==========================================
echo Validation complete!
echo.
pause
