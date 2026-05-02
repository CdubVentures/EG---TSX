@echo off
title EG - Dev Server
cd /d "%~dp0"
echo Managed Astro dev launcher (astro dev on port 4321).
call node --import tsx scripts/dev-server-control.ts start-dev
pause
