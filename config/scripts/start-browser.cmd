@echo off
echo ============================================
echo   EG Config Manager
echo   http://localhost:8430
echo ============================================
echo.
cd /d "%~dp0"

echo Building config bundle...
cd /d "%~dp0..\.."
call npx esbuild config/ui/_entry.tsx --bundle --format=iife --jsx=automatic --charset=utf8 --sourcemap --outfile=config/ui/app.bundle.js
echo Bundle built.
echo.

cd /d "%~dp0..\app"
python -m uvicorn main:app --port 8430
pause
