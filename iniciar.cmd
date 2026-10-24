@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instala Node.js 22.13 o posterior antes de abrir Folio.
  pause
  exit /b 1
)
if not exist node_modules\pdf-parse (
  echo Primero ejecuta instalar.cmd. La instalacion requiere Internet; la app funciona localmente.
  pause
  exit /b 1
)
node server.mjs --open
pause
