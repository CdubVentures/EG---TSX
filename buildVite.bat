@echo off
title EG - Production Build
cd /d "%~dp0"
call npx astro build
echo Opening preview...
start http://localhost:4321
call npx astro preview
pause
