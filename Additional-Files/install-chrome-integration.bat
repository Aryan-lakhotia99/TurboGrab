@echo off
title TurboGrab Chrome/Edge Native Registry Installer
cd /d "%~dp0"

echo ======================================================================
echo    TurboGrab Native Chrome/Edge Host Registry Setup
echo ======================================================================
echo.

set "MANIFEST_PATH=%~dp0extension\host\com.turbograb.host.json"

echo Registering com.turbograb.host for Google Chrome...
reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.turbograb.host" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul 2>&1

echo Registering com.turbograb.host for Microsoft Edge...
reg add "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.turbograb.host" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul 2>&1

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] Successfully registered Native Host in Windows Registry!
) else (
    echo.
    echo [Notice] Could not modify registry. Please run this batch file as Administrator if needed.
)

echo.
pause
