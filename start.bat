@echo off
setlocal EnableDelayedExpansion
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

REM 1. Cerrar TODOS los servidores previos que ocupen el puerto local %PORT%
REM    (tanto en estado LISTENING como ESTABLISHED / FIN_WAIT / CLOSE_WAIT)
echo [1/3] Verificando y liberando puerto %PORT%...
set "KILLED_ANY=0"
for /f "tokens=2,5" %%a in ('netstat -aon ^| findstr ":%PORT% "') do (
    echo %%a | findstr /R ":%PORT%$" >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        if not "%%b"=="0" (
            echo [INFO] Terminando arbol de proceso en puerto %PORT% [PID %%b]...
            taskkill /F /T /PID %%b >nul 2>&1
            set "KILLED_ANY=1"
        )
    )
)

REM Refuerzo con PowerShell Get-NetTCPConnection por si queda algun proceso en IPv4/IPv6
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort %PORT% -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 4 } | ForEach-Object { taskkill /F /T /PID $_ }" >nul 2>&1

if "%KILLED_ANY%"=="1" (
    timeout /t 1 /nobreak >nul
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

call npx vite --port %PORT% --strictPort
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] El servidor se ha detenido o no se pudo iniciar.
    pause
)
