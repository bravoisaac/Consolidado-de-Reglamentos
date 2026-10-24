@echo off
setlocal
cd /d "%~dp0"
echo Instalando dependencias de la app. No se envian documentos.
call npm ci --no-audit --no-fund
pause
