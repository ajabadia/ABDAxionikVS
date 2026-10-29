@echo off
setlocal

echo =======================================================
echo     ABDAxionikVS - WebAssembly DSP Build (Emscripten)
echo =======================================================

REM Ensure Ninja/CMake from Visual Studio are available if not already in PATH
where ninja >nul 2>nul
if %ERRORLEVEL% neq 0 (
    if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" (
        call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" >nul 2>nul
    )
)

REM Activate Emscripten SDK if emcmake is not in PATH
where emcmake >nul 2>nul
if %ERRORLEVEL% neq 0 (
    if exist "%EMSDK%\emsdk_env.bat" (
        call "%EMSDK%\emsdk_env.bat"
    ) else if exist "D:\desarrollos\emsdk\emsdk_env.bat" (
        call "D:\desarrollos\emsdk\emsdk_env.bat"
    ) else if exist "C:\emsdk\emsdk_env.bat" (
        call "C:\emsdk\emsdk_env.bat"
    ) else (
        echo [ERROR] emcmake no encontrado en PATH ni en D:\desarrollos\emsdk / C:\emsdk.
        exit /b 1
    )
)

pushd "%~dp0"

set BUILD_DIR=build_wasm
set OUT_DIR=..\WebUI\src\wasm
set DIST_WASM_DIR=..\WebUI\dist\wasm
set DIST_SRC_WASM_DIR=..\WebUI\dist\src\wasm

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"

echo [1/3] Configurando CMake con Emscripten...
call emcmake cmake -G Ninja -S . -B "%BUILD_DIR%" -DCMAKE_BUILD_TYPE=Release
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Fallo en emcmake cmake configure.
    popd
    exit /b 1
)

echo [2/3] Compilando abdaxionikvs_dsp.wasm...
call cmake --build "%BUILD_DIR%" --target abdaxionikvs_dsp
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Fallo en la compilacion WASM.
    popd
    exit /b 1
)

echo [3/3] Copiando artefactos WASM a %OUT_DIR% y WebUI/dist...
copy /Y "%BUILD_DIR%\abdaxionikvs_dsp.js" "%OUT_DIR%\abdaxionikvs_dsp.js" >nul
if exist "%BUILD_DIR%\abdaxionikvs_dsp.wasm" (
    copy /Y "%BUILD_DIR%\abdaxionikvs_dsp.wasm" "%OUT_DIR%\abdaxionikvs_dsp.wasm" >nul
)

if exist "..\WebUI\dist" (
    if not exist "%DIST_WASM_DIR%" mkdir "%DIST_WASM_DIR%"
    if not exist "%DIST_SRC_WASM_DIR%" mkdir "%DIST_SRC_WASM_DIR%"
    copy /Y "%OUT_DIR%\*" "%DIST_WASM_DIR%\" >nul
    copy /Y "%OUT_DIR%\*" "%DIST_SRC_WASM_DIR%\" >nul
)

popd
echo =======================================================
echo  [EXITO] WebAssembly compilado en WebUI\src\wasm\
echo =======================================================
exit /b 0

