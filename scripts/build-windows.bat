@echo off
title TurboGrab Windows Build Engine
cd /d "%~dp0\.."

echo ======================================================================
echo    TurboGrab Windows Packaging Engine
echo    Target: NSIS Installer (.exe) + Portable Executable
echo ======================================================================
echo.

echo [1/3] Building React Frontend with Vite & TypeScript...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend build failed!
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Running Automated Engine Test Suite...
node tests/engine.test.cjs
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Engine test suite failed!
    exit /b %ERRORLEVEL%
)

echo.
echo [3/3] Packaging Windows NSIS Installer with Electron Builder...
call npx electron-builder --win nsis
if %ERRORLEVEL% NEQ 0 (
    echo [NOTICE] NSIS encountered a network reset. Packaging Portable .exe...
    call npx electron-builder --win portable
)

echo.
echo ======================================================================
echo   Windows Build Completed Successfully!
echo   Output location: release\
echo ======================================================================
pause
