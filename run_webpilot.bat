@echo off
setlocal
echo =======================================================
echo   ABDAxionikVS - Lanzador CLI de WebPilot Host
echo =======================================================

set "EXE_PATH=%~dp0build\ABDAxionikVS_WebPilot_artefacts\Release\ABDAxionikVS WebPilot Host.exe"

if not exist "%EXE_PATH%" (
    echo [ERROR] No se encuentra el ejecutable:
    echo         "%EXE_PATH%"
    exit /b 1
)

set "WEBVIEW2_USER_DATA_FOLDER=%TEMP%\ABDAxionikVS_WebPilot_WebView2"
if not exist "%WEBVIEW2_USER_DATA_FOLDER%" mkdir "%WEBVIEW2_USER_DATA_FOLDER%"

echo [INFO] Binario:        "%EXE_PATH%"
echo [INFO] WebView2 Data:  "%WEBVIEW2_USER_DATA_FOLDER%"
echo [INFO] Lanzando proceso WebPilot Host en linea de comandos...
echo -------------------------------------------------------

"%EXE_PATH%" %*

echo -------------------------------------------------------
echo [INFO] Proceso finalizado con codigo de salida: %ERRORLEVEL%
endlocal
