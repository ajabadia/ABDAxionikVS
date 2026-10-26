@echo off
setlocal
REM ============================================================
REM start.bat — ABDAxionikVS Dev & Standalone Runner
REM Mata procesos previos en el puerto 5320, abre la interfaz
REM y lanza el Standalone o el Vite dev server.
REM ============================================================

set "PORT=5320"
set "URL=http://localhost:%PORT%"

echo ============================================================
echo   ABDAxionikVS — Hartmann Neuron VS Reborn
echo   Puerto WebUI: %PORT%
echo ============================================================

REM 1. Cerrar procesos previos ocupando el puerto 5320
echo [1/3] Liberando puerto %PORT% si estuviera ocupado...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    echo [INFO] Cerrando proceso previo en puerto %PORT% [PID %%a]
    taskkill /F /PID %%a >nul 2>&1
)

REM 2. Verificar o compilar si no existen los ejecutables
set "STANDALONE_EXE=build\ABDAxionikVS_artefacts\Release\Standalone\ABDAxionikVS.exe"

if not exist "%STANDALONE_EXE%" (
    echo [INFO] Binario Standalone no encontrado. Compilando proyecto...
    call build.bat nopause
)

REM 3. Lanzar aplicación Standalone
if exist "%STANDALONE_EXE%" (
    echo [2/3] Abriendo navegador / interfaz en %STANDALONE_EXE%...
    start "" "%STANDALONE_EXE%"
) else (
    echo [AVISO] No se pudo encontrar %STANDALONE_EXE%.
    echo [2/3] Abriendo en navegador web: %URL%
    start "" "%URL%"
    echo [3/3] Iniciando Vite Dev Server...
    call npx vite --port %PORT%
)

echo ============================================================
echo   ABDAxionikVS iniciado con exito.
echo ============================================================
