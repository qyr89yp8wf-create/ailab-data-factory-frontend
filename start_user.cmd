@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js and try again.
  pause
  exit /b 1
)
node.exe "%~dp0start_user.mjs"
if errorlevel 1 (
  echo.
  echo Startup failed. Please check the error above.
  pause
  exit /b 1
)
endlocal
