@echo off
echo Limpando dados do MoneyGen (requer dispositivo/emulador conectado via adb)...
cd /d "%~dp0.."
node scripts/clear-data.js
pause