@echo off
REM Windows Executable Wrapper
REM This creates a clickable executable for Windows

cd /d "%~dp0"

REM Check if in the right directory
if not exist "Units.xlsx" (
    echo Please place this file in the traininggov-scraper folder!
    pause
    exit /b 1
)

REM Run the scraper
START.bat
