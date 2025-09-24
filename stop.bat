@echo off
echo 🔴 Stopping Node.js servers...

REM Kill all node.exe processes
taskkill /IM node.exe /F >nul 2>&1

echo ✅ All Node.js servers have been stopped.
pause
