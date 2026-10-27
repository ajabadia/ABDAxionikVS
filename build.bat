@echo off
setlocal enabledelayedexpansion

echo =======================================================
echo          ABDAxionikVS - Pipeline de Compilacion
echo =======================================================

REM Cerrar instancias en ejecucion para liberar el lock de enlace en disco
taskkill /F /IM ABDAxionikVS.exe /T 2>nul
taskkill /F /IM "ABDAxionikVS WebPilot Host.exe" /T 2>nul

echo [1/5] Generando registros y contratos canonicos...
node Scripts/registry_generator.js
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Fallo en registry_generator.js
    goto error_exit
)

echo [2/5] Ejecutando suite de tests de contratos (Vitest)...
call npx vitest run
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Fallaron los tests unitarios de contratos.
    goto error_exit
)

echo [3/5] Compilando bundle WebUI (Vite -> WebUI/dist/)...
node Scripts/build_webui.js
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Fallo al empaquetar WebUI.
    goto error_exit
)

echo [4/5] Configurando CMake nativo...
cmake -B build -S . -DCMAKE_BUILD_TYPE=Release
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Fallo en la configuracion de CMake.
    goto error_exit
)

echo [5/5] Compilando Standalone, VST3 y WebPilotHost...
cmake --build build --config Release --target ABDAxionikVS_Standalone ABDAxionikVS_VST3 ABDAxionikVS_WebPilot --parallel
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Fallo en la compilacion de los binarios nativos.
    goto error_exit
)

echo =======================================================
echo  [EXITO] Compilacion completada con exito!
echo  Standalone: build\ABDAxionikVS_artefacts\Release\Standalone\ABDAxionikVS.exe
echo  VST3:       build\ABDAxionikVS_artefacts\Release\VST3\ABDAxionikVS.vst3
echo  WebPilot:   build\Release\ABDAxionikVS_WebPilot.exe
echo =======================================================

if "%1"=="nopause" exit /b 0

pause
exit /b 0

:error_exit
echo.
echo [ERROR] Fallo el pipeline de build.
if "%1"=="nopause" exit /b 1
pause
exit /b 1
