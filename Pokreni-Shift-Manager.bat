@echo off
title Seherezada Shift Pro Server
cd /d "%~dp0"
echo ======================================================
echo    SEHEREZADA SHIFT PRO - POKRETANJE SISTEMA
echo ======================================================
echo.
echo [1/2] Otvaram pretrazivac na http://localhost:3000 ...
timeout /t 1 /nobreak >nul
start http://localhost:3000
echo [2/2] Pokrecem server sa SQLite bazom podataka...
node server/index.js
pause

