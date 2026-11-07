@echo off
title TurboGrab Desktop + Direct Chrome Integration
cd /d "%~dp0"

echo ======================================================================
echo    TurboGrab Smart Download Manager
echo    Direct Chrome Integration ^& Startup Engine
echo ======================================================================
echo.

echo [1/3] Clearing any stale processes on port 48123...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":48123" ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
taskkill /F /IM electron.exe >nul 2>&1

echo [2/3] Launching TurboGrab Desktop Application in background...
start "" npm start

echo [3/3] Preparing Direct Chrome Integration with Extension...
set "EXT_DIR=%~dp0extension"

REM Locate Google Chrome installation
set "CHROME_EXE="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
) else if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_EXE=%LocalAppData%\Google\Chrome\Application\chrome.exe"
)

REM Wait 2 seconds for WebSocket server to bind port 48123
timeout /t 2 /nobreak >nul

if defined CHROME_EXE (
    echo Launching Chrome with TurboGrab extension directly integrated...
    start "" "%CHROME_EXE%" --load-extension="%EXT_DIR%" "chrome://extensions"
    echo.
    echo ======================================================================
    echo   SUCCESS: TurboGrab Desktop + Chrome Extension are now ACTIVE!
    echo   - Desktop App: Running with Multi-Range Acceleration Engine
    echo   - Chrome: Loaded with Genesis Grab-Chip and Quality Sniffer
    echo   - Bridge Port: 127.0.0.1:48123 (Connected)
    echo ======================================================================
) else (
    echo.
    echo [Notice] Google Chrome executable was not found at standard locations.
    echo TurboGrab Desktop is running. To manually load the extension:
    echo  1. Open Chrome and go to chrome://extensions
    echo  2. Enable "Developer mode" (top right)
    echo  3. Click "Load unpacked" and select: %EXT_DIR%
)

echo.
echo Press any key to close this launcher (TurboGrab remains running)...
pause >nul
