@echo off
setlocal

if exist "build\ABDAxionikVS_artefacts\Release\Standalone\ABDAxionikVS.exe" (
    echo [LANZANDO] ABDAxionikVS Standalone...
    start "" "build\ABDAxionikVS_artefacts\Release\Standalone\ABDAxionikVS.exe"
    exit /b 0
)

if exist "build\Release\ABDAxionikVS_WebPilot.exe" (
    echo [LANZANDO] ABDAxionikVS WebPilot Host...
    start "" "build\Release\ABDAxionikVS_WebPilot.exe"
    exit /b 0
)

echo [AVISO] Binario no encontrado. Ejecutando compilacion...
call build.bat nopause

if exist "build\ABDAxionikVS_artefacts\Release\Standalone\ABDAxionikVS.exe" (
    start "" "build\ABDAxionikVS_artefacts\Release\Standalone\ABDAxionikVS.exe"
)
