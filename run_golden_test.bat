@echo off
setlocal
echo =======================================================
echo   ABDAxionikVS — Verificacion Offline (Golden Parity)
echo =======================================================

if not exist "build\Release\GoldenParityTest.exe" (
    echo [ERROR] No se encontro build\Release\GoldenParityTest.exe.
    echo Ejecuta build.bat para compilar el arnes de pruebas.
    exit /b 1
)

build\Release\GoldenParityTest.exe %*
