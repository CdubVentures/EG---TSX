@echo off
title EG - Production Build
cd /d "%~dp0"
echo Running astro build before managed astro preview restart.
call npx astro build
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo Build failed.
  pause
  exit /b 1
)
echo Restarting astro preview server on port 4322...
call node --import tsx scripts/dev-server-control.ts restart-preview
pause
