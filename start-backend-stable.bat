@echo off
echo 🚀 Starting Stable Backend Server...
echo.

:start
echo 📅 %date% %time% - Starting backend...
cd backend
npm run dev

echo.
echo ❌ Backend crashed! Restarting in 3 seconds...
timeout /t 3 /nobreak > nul
goto start