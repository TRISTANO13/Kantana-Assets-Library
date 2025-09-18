@echo off
setlocal

REM Dossiers
set "SERVER_DIR=%USERPROFILE%\Documents\Asset Library Project\Server"
set "WEB_DIR=%USERPROFILE%\Documents\Asset Library Project\Web"

REM --- Démarre chaque app dans un process séparé (fenêtre minimisée) ---
powershell -NoProfile -WindowStyle Hidden -Command ^
  "Start-Process cmd -ArgumentList '/c','npm start' -WorkingDirectory '%SERVER_DIR%' -WindowStyle Hidden"

powershell -NoProfile -WindowStyle Hidden -Command ^
  "Start-Process cmd -ArgumentList '/c','npm run dev' -WorkingDirectory '%WEB_DIR%' -WindowStyle Hidden"


REM Ferme la fenêtre batch immédiatement
exit /b
