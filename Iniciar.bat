@echo off
chcp 65001 >nul
title Mi Centro de Entretenimiento
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  ❌ Necesitas instalar Node.js primero.
  echo     Descargalo gratis de: https://nodejs.org/es
  echo.
  pause
  exit /b 1
)
if not exist node_modules (
  echo  📦 Primera vez: instalando dependencias, esto tarda 1-2 minutos...
  call npm install
)
echo  🎬 Iniciando Mi Centro de Entretenimiento...
echo     El navegador se abrira solo. Para cerrar la app, cierra esta ventana.
call npm run dev
