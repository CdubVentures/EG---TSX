@echo off
echo ============================================
echo   EG Deploy Control Center
echo   http://localhost:8420
echo ============================================
echo.
cd /d "%~dp0"

REM Build the dashboard bundle (React + app → single JS file)
echo Building dashboard bundle...
cd /d "%~dp0..\.."
call npx esbuild tools/deploy-dashboard/ui/_entry.jsx --bundle --format=iife --jsx=transform --charset=utf8 --minify --alias:node:fs=./tools/deploy-dashboard/ui/browser-fs-shim.js "--define:import.meta.url=\"file:///browser\"" --outfile=tools/deploy-dashboard/ui/app.bundle.js
echo Bundle built.
echo.

cd /d "%~dp0..\app"
python -m uvicorn main:app --port 8420
pause
