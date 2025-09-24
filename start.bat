@echo off
setlocal

REM Folders
set "SERVER_DIR=%USERPROFILE%\Documents\Asset Library Project\Server"
set "WEB_DIR=%USERPROFILE%\Documents\Asset Library Project\Web"

REM --- Start each app in a separate process (minimized window) ---
powershell -NoProfile -WindowStyle Hidden -Command ^
  "Start-Process cmd -ArgumentList '/c','npm start' -WorkingDirectory '%SERVER_DIR%' -WindowStyle Hidden"

powershell -NoProfile -WindowStyle Hidden -Command ^
  "Start-Process cmd -ArgumentList '/c','npm run dev' -WorkingDirectory '%WEB_DIR%' -WindowStyle Hidden"

REM Close the batch window immediately
exit /b
