# ---------------------------------------------------------------------------
# run-reaper-param-groups.ps1 — lanza la verificación de grupos de parámetros
#
# Arranca una instancia NUEVA de REAPER (-newinst) con un proyecto vacío, le
# pasa el ReaScript, espera su informe y cierra esa instancia (solo el proceso
# que este script arrancó). No toca ninguna sesión de REAPER que ya estuviera
# abierta.
#
#   powershell -ExecutionPolicy Bypass -File tools\reaper-param-groups\run-reaper-param-groups.ps1
#
# Salida: 0 si todas las comprobaciones pasan, 1 si alguna falla o si no hay
# informe. El detalle queda en tools\reaper-param-groups\report.json.
# ---------------------------------------------------------------------------
[CmdletBinding()]
param(
    [string]$Plugin = 'ABDAxionikVS',
    [int]$TimeoutSeconds = 120,
    [string]$ReaperExe = $env:ABD_REAPER_EXE
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$lua = Join-Path $here 'reaper_param_groups.lua'
$report = Join-Path $here 'report.json'

if (-not (Test-Path $lua)) {
    throw "Falta el script: $lua"
}

if (-not $ReaperExe) {
    $candidates = @(
        'C:\Program Files\REAPER (x64)\reaper.exe',
        'C:\Program Files\REAPER\reaper.exe'
    )
    $ReaperExe = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $ReaperExe -or -not (Test-Path $ReaperExe)) {
    throw 'No encuentro reaper.exe. Pásalo con -ReaperExe o define ABD_REAPER_EXE.'
}

# El script escribe el informe en esta ruta; si queda el de la vez anterior,
# no hay forma de saber si el nuevo se escribió.
if (Test-Path $report) { Remove-Item $report -Force }

$env:ABD_REAPER_PLUGIN = $Plugin
$env:ABD_REAPER_QUIET = '1'
$env:ABD_REAPER_REPORT = $report

Write-Host "Lanzando $ReaperExe con una instancia nueva..."
$proc = Start-Process -FilePath $ReaperExe `
    -ArgumentList @('-newinst', '-new', '-nosplash', $lua) `
    -PassThru

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline -and -not (Test-Path $report)) {
    Start-Sleep -Milliseconds 500
}

$exitCode = 1
try {
    if (-not (Test-Path $report)) {
        Write-Host "Sin informe tras $TimeoutSeconds s. ¿El VST3 está en una ruta VST y escaneado?" -ForegroundColor Red
    }
    else {
        $data = Get-Content -Raw -Encoding UTF8 $report | ConvertFrom-Json

        Write-Host ''
        Write-Host "FX:         $($data.plugin)"
        Write-Host "REAPER:     $($data.reaper)"
        Write-Host ("Parametros: {0} (con seccion {1}, del host {2})" -f $data.numParams, $data.sectioned, $data.pseudoParams)
        if ($null -ne $data.expected) {
            Write-Host ("Registro:   {0} parametros" -f $data.expected)
        }
        elseif ($data.numParams -eq 0) {
            Write-Host 'Registro:   no aplica (la comprobacion no llego a ejecutarse)'
        }
        else {
            Write-Host 'Registro:   no encontrado (sin comprobacion de recuento)'
        }
        Write-Host ''
        foreach ($s in $data.sections) {
            Write-Host ('  {0,-16} {1,4}' -f $s.name, $s.count)
        }
        Write-Host ''
        foreach ($c in $data.checks) {
            $tag = if ($c.ok) { 'OK   ' } else { 'FALLO' }
            $detail = if (-not $c.ok -and $c.detail) { " - $($c.detail)" } else { '' }
            Write-Host ("  [{0}] {1}{2}" -f $tag, $c.name, $detail)
        }
        Write-Host ''
        if ($data.ok) {
            Write-Host 'RESULTADO: OK' -ForegroundColor Green
            $exitCode = 0
        }
        else {
            Write-Host 'RESULTADO: FALLO' -ForegroundColor Red
        }
        Write-Host "Informe:    $report"
    }
}
finally {
    if ($proc) {
        $proc.Refresh()
        if (-not $proc.HasExited) {
            # Solo la instancia que arrancamos aquí, con un proyecto vacío.
            Stop-Process -Id $proc.Id -Force
        }
    }
}

exit $exitCode
