@echo off
setlocal
cd /d "%~dp0"
echo Bloquea el acceso a Internet de Ollama y sus motores instalados.
echo Mantiene la comunicacion local. Tambien impide descargar modelos.
echo Debes ejecutar este archivo con clic derecho: Ejecutar como administrador.
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0scripts\ollama-firewall.ps1" -Mode Install
if errorlevel 1 (
  echo No se ha confirmado el bloqueo. La IA de Folio permanecera deshabilitada.
) else (
  echo Bloqueo verificado. Puedes activar IA local en Folio.
)
pause
