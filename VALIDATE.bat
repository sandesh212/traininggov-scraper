@echo off
REM Double-clickable Windows launcher for Assessment Validator

cd /d "%~dp0"

echo ==========================================
echo   RTO Assessment Validator (Ollama)
echo ==========================================
echo.

REM Check if Ollama is installed
where ollama >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Ollama is not installed!
    echo.
    echo Please install Ollama first:
    echo   1. Visit: https://ollama.com/download
    echo   2. Download and install Ollama for Windows
    echo   3. Run this launcher again
    echo.
    pause
    exit /b 1
)

REM Check if Ollama is running
curl -s http://localhost:11434/api/tags >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Ollama is not running. Starting Ollama...
    start /B ollama serve
    timeout /t 3 /nobreak >nul
)

REM Check for required models
echo Checking Ollama models...
ollama list | findstr /C:"llama3.2" >nul
if %ERRORLEVEL% NEQ 0 (
    echo Downloading llama3.2 model (this may take a few minutes)...
    ollama pull llama3.2
)

ollama list | findstr /C:"nomic-embed-text" >nul
if %ERRORLEVEL% NEQ 0 (
    echo Downloading nomic-embed-text model...
    ollama pull nomic-embed-text
)

echo.
echo All requirements met!
echo.
echo Starting validation...
echo ==========================================
echo.

REM Run the validator
cd .config
call npm run auto

echo.
echo ==========================================
echo Validation complete!
echo.
pause
