@echo off
title EG - Restart Dev Server
cd /d "%~dp0"
echo Managed Astro dev restart with node_modules\.vite cache reset.
call node --import tsx scripts/dev-server-control.ts restart-dev
pause
