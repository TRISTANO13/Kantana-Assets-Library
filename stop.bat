@echo off
echo 🔴 Arrêt des serveurs Node.js...

REM Tue tous les process node.exe
taskkill /IM node.exe /F >nul 2>&1

echo ✅ Tous les serveurs Node.js ont été arrêtés.
pause
