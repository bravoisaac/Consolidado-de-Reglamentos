@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0scripts\setup-windows.ps1" -Mode Check
echo.
echo Consulta MANUAL-IA.md para instalar lo que falte.
pause
