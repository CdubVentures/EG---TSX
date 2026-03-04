@echo off
title EG - Restart Dev Server
cd /d "%~dp0"
echo Stopping existing dev server...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4321" ^| findstr "LISTENING"') do taskkill /F /PID %%a 2>nul
timeout /t 1 /nobreak >nul
echo Starting dev server...
call npx astro dev --open
pause
