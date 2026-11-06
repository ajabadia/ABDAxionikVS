@echo off
REM Compila el motor Resynator v2 a WASM y lo publica en ABDNeuModMakr.
REM Doble clic o: build-resynator-wasm.bat [-SkipSmoke]
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-resynator-wasm.ps1" %*
if errorlevel 1 (
  echo.
  echo [ERROR] El build WASM fallo. La web sigue usando el artefacto anterior bueno.
  pause
)
