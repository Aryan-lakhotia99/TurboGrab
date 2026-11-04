@echo off
title TurboGrab Desktop Accelerator
cd /d "%~dp0"

echo ======================================================================
echo    TurboGrab Smart Download Manager
echo    Pure Node.js / Electron Desktop App
echo ======================================================================
echo.
echo Choose an option:
echo   [1] Start TurboGrab Desktop + Automatically Launch Chrome with Extension
echo   [2] Start TurboGrab Desktop Only
echo.
choice /c 12 /t 5 /d 1 /m "Select option (defaulting to 1 in 5s):"

if errorlevel 2 goto ONLY_DESKTOP
if errorlevel 1 goto WITH_CHROME

:WITH_CHROME
call "%~dp0Start-TurboGrab-With-Chrome.bat"
goto END

:ONLY_DESKTOP
echo Clearing any stale processes on port 48123...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":48123" ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
taskkill /F /IM electron.exe >nul 2>&1
echo Launching native desktop window...
npm start

:END
pause
