@echo off
title EG - Dev Server
cd /d "%~dp0"
call npx astro dev --open
pause
