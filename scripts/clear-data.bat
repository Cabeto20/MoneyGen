@echo off
echo Limpando dados do FinaManagement...
cd /d "%~dp0.."
node scripts/clear-data.js
pause