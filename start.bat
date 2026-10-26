@echo off
setlocal
REM ============================================================
REM start.bat — Servidor de desarrollo local para ABDAxionikVS WebUI
REM (Hartmann Neuron / NeuronVS Reborn — Modern Web Edition)
REM ============================================================

set "PORT=5320"
set "URL=http://localhost:%PORT%"

echo ============================================================
echo   ABDAxionikVS — Hartmann Neuron VS (Web Edition)
echo   Puerto: %PORT%
echo ============================================================

REM 1. Cerrar procesos previos en el puerto 5320
echo [1/3] Verificando y liberando puerto %PORT%...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    echo [INFO] Cerrando proceso previo en puerto %PORT% [PID %%a]
    taskkill /F /PID %%a >nul 2>&1
)

REM 2. Abrir navegador en la WebUI
echo [2/3] Abriendo navegador en %URL%...
start "" "%URL%"

REM 3. Iniciar Vite dev server
echo [3/3] Iniciando Vite Dev Server...
echo ============================================================
echo   URL: %URL%
echo   Directorio WebUI: WebUI\index.html
echo   Pulsa Ctrl+C para detener el servidor
echo ============================================================

call npx vite --port %PORT%
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] El servidor se ha detenido o no se pudo iniciar.
    pause
)
