@echo off
REM Smart Universal Validator - Windows
cd /d "%~dp0"
echo 🧠 SMART Universal Validator
echo Auto-detects Everything!
echo.
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found!
    pause
    exit /b 1
)
echo ✅ Node.js found
if "%~1"=="" (
    cd .config
    call npx tsx smart-validate.ts
) else (
    cd .config
    call npx tsx smart-validate.ts "%~1"
)
echo.
pause
