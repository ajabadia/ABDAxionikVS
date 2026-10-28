@echo off
setlocal
echo =======================================================
echo   ABDAxionikVS - Lanzador CLI de Standalone Host
echo =======================================================

set "EXE_PATH=%~dp0build\ABDAxionikVS_artefacts\Release\Standalone\ABDAxionikVS.exe"

if not exist "%EXE_PATH%" (
    echo [ERROR] No se encuentra el ejecutable:
    echo         "%EXE_PATH%"
    echo         Ejecuta primero .\build.bat para compilar el proyecto.
    exit /b 1
)

:: Aislar userDataFolder de WebView2 para evitar conflictos de permisos de Windows
set "WEBVIEW2_USER_DATA_FOLDER=%TEMP%\ABDAxionikVS_WebView2"
if not exist "%WEBVIEW2_USER_DATA_FOLDER%" mkdir "%WEBVIEW2_USER_DATA_FOLDER%"

:: Cerrar instancias huérfanas previas si existieran
taskkill /F /IM ABDAxionikVS.exe 2>nul

echo [INFO] Binario:        "%EXE_PATH%"
echo [INFO] WebView2 Data:  "%WEBVIEW2_USER_DATA_FOLDER%"
echo [INFO] Lanzando proceso Standalone en ventana independiente...
echo -------------------------------------------------------

start "" "%EXE_PATH%" %*

echo [INFO] ABDAxionikVS iniciado con exito en primer plano.
endlocal
