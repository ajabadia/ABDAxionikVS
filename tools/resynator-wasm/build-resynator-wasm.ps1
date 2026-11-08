#Requires -Version 5.1
<#
  build-resynator-wasm.ps1 — Compila el motor REAL (AxionikExpandedSynthesizer.h)
  a WebAssembly y lo publica en ABDNeuModMakr/public/wasm/ con test de humo.

  Uso:  .\build-resynator-wasm.ps1 [-EmsdkRoot D:\desarrollos\emsdk] [-SkipSmoke]
  O doble clic en build-resynator-wasm.bat.

  La lista de fuentes NO vive en este script: se lee de DspSources.cmake
  (AXIONIK_RESYNATOR_WASM_SOURCES) con dump-sources.cmake, y de ella salen tanto
  la compilacion como la lista `sources` y el `engineHash` del manifiesto.

  Filosofía: el .js generado NO se commitea (es artefacto). Lo que sí se
  commitea es la prueba que falla si el artefacto falta o está obsoleto
  (tests/resynatorWasmParity.test.ts). Olvidar este script = test en rojo,
  nunca audio equivocado en silencio.
#>
[CmdletBinding()]
param(
  [string]$EmsdkRoot = $(if ($env:EMSDK) { $env:EMSDK } else { 'D:/desarrollos/emsdk' }),
  [switch]$SkipSmoke
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ToolsDir = $PSScriptRoot
$RepoRoot = (Split-Path (Split-Path $ToolsDir -Parent) -Parent)  # ABDAxionikVS/
$MakrRoot = Join-Path (Split-Path $RepoRoot -Parent) 'ABDNeuModMakr'
$WasmDir  = Join-Path $MakrRoot 'public/wasm'
$OutDir   = Join-Path $ToolsDir 'out'

# La lista de fuentes NO se mantiene aqui: vive en DspSources.cmake, compartida con
# el build nativo y el WASM del plugin. dump-sources.cmake la escribe en un fichero
# (message() de CMake sale por stderr, asi que no se puede leer de la salida).
$SourcesScript = Join-Path $ToolsDir 'dump-sources.cmake'
$SourcesDump   = Join-Path ([IO.Path]::GetTempPath()) "resynator-wasm-sources-$PID.txt"
$cmake = Get-Command cmake -ErrorAction SilentlyContinue
if (-not $cmake) {
  throw 'cmake no esta en el PATH; se necesita para leer la lista compartida de fuentes.'
}
& $cmake.Source "-DAXIONIK_SOURCES_OUT=$SourcesDump" -P $SourcesScript
if ($LASTEXITCODE -ne 0) { throw "dump-sources.cmake fallo (exit $LASTEXITCODE)." }
$SharedSources = @([IO.File]::ReadAllLines($SourcesDump) |
  ForEach-Object { $_.Trim() } |
  Where-Object { $_.Length -gt 0 })
Remove-Item $SourcesDump -Force -ErrorAction SilentlyContinue
if ($SharedSources.Count -eq 0) { throw 'La lista compartida de fuentes esta vacia.' }

foreach ($p in $SharedSources) {
  if (-not (Test-Path $p)) { throw "Falta fuente de la verdad: $p" }
}

# Exactamente un .cpp: la fachada C-ABI que se compila. Las cabeceras entran en el hash.
$Wrappers = @($SharedSources | Where-Object { $_ -like '*.cpp' })
if ($Wrappers.Count -ne 1) {
  throw "La lista compartida debe declarar exactamente un .cpp (la fachada); hay $($Wrappers.Count)."
}
$Wrapper = $Wrappers[0]
$Emcc = Join-Path $EmsdkRoot 'upstream/emscripten/emcc.exe'
if (-not (Test-Path $Emcc)) {
  throw "emcc no encontrado en $Emcc. Pasa -EmsdkRoot o define `$env:EMSDK."
}

# La ABI vive en UNA sola línea del wrapper; el resto del sistema la lee de aquí.
$abiLine = Select-String -Path $Wrapper -Pattern '#define RESYNATOR_V2_WASM_ABI (\d+)' |
  Select-Object -First 1
if (-not $abiLine) { throw 'No se encontró RESYNATOR_V2_WASM_ABI en el wrapper.' }
$Abi = $abiLine.Matches[0].Groups[1].Value
$ArtifactName = "resynator-v2-abi$Abi.js"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$OutJs = Join-Path $OutDir $ArtifactName

Write-Host "== ResynatorV2 WASM (ABI $Abi) ==" -ForegroundColor Cyan
Write-Host "emcc: $Emcc"

$exported = '_resynAbiVersion,_resynCreate,_resynLoadModel,_resynHasModel,' +
  '_resynNoteOn,_resynNoteOff,_resynAllNotesOff,_resynRenderBlock,_resynLastError'
$runtime = 'ccall,cwrap,UTF8ToString,lengthBytesUTF8,stringToUTF8,HEAPF32,HEAPU8'

# STACK_SIZE=4MB: el parser JSON del motor es recursivo y los documentos reales
# (extensiones avanzadas + superficie + multi-muestra, ~100 KB) agotan los 64 KB
# de pila WASM por defecto: la carga abortaba con `memory access out of bounds`.
# NO es un bug del DSP (en nativo hay 8 MB de pila y los 16 tests C++ pasan);
# es ajuste de build. El humo carga un documento grande a propósito: si alguien
# quita esto, el humo falla en voz alta antes de publicar.
& $Emcc $Wrapper -O3 `
  -s SINGLE_FILE=1 -s MODULARIZE=1 -s EXPORT_ES6=1 `
  -s ALLOW_MEMORY_GROWTH=1 -s STACK_SIZE=4MB -s ENVIRONMENT=node,web `
  "-sEXPORTED_FUNCTIONS=$exported" "-sEXPORTED_RUNTIME_METHODS=$runtime" `
  -o $OutJs
if ($LASTEXITCODE -ne 0) { throw "emcc falló (exit $LASTEXITCODE)." }
Write-Host "Compilado: $OutJs ($([math]::Round((Get-Item $OutJs).Length / 1KB)) KB)" -ForegroundColor Green

if (-not $SkipSmoke) {
  Write-Host 'Humo: cargando el artefacto en Node + render dorado…' -ForegroundColor Cyan
  $node = (Get-Command node -ErrorAction SilentlyContinue).Source
  if (-not $node) { throw 'Node.js no está en el PATH; necesario para el humo.' }
  $fixture = Join-Path $MakrRoot 'tests/fixtures/resynator-v2-model.json'
  $largeFixture = Join-Path $MakrRoot 'tests/fixtures/resynator-v2-large.json'
  if (-not (Test-Path $largeFixture)) {
    throw "Falta fixture $largeFixture. Genéralo con: npx tsx scripts/gen-resynator-golden.ts --model-only"
  }
  if (-not (Test-Path $fixture)) {
    throw "Falta fixture $fixture. Genéralo con: npx tsx scripts/gen-resynator-golden.ts"
  }
  & $node (Join-Path $ToolsDir 'smoke-resynator-wasm.mjs') $OutJs $Abi $fixture $largeFixture
  if ($LASTEXITCODE -ne 0) { throw 'Humo ROJO: el artefacto no pasa. NO se publica.' }
  Write-Host 'Humo VERDE.' -ForegroundColor Green
}

New-Item -ItemType Directory -Force -Path $WasmDir | Out-Null
Copy-Item $OutJs (Join-Path $WasmDir $ArtifactName) -Force
# El hash del motor y la lista `sources` del manifiesto salen de la MISMA lista
# compartida: anadir una fuente en DspSources.cmake actualiza el manifiesto y el
# hash sin tocar este script.
$engineHashSeed = ''
$relativeSources = @()
# dump-sources.cmake escribe las rutas con '/' (estilo CMake) y $RepoRoot llega
# con '\' en Windows: se normalizan ambas antes de comparar, o el StartsWith
# rechaza fuentes que SI estan dentro del repo.
$RepoRootFull = [IO.Path]::GetFullPath($RepoRoot)
foreach ($source in $SharedSources) {
  $sourcePath = [IO.Path]::GetFullPath($source)
  if (-not $sourcePath.StartsWith($RepoRootFull + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Fuente fuera de $RepoRootFull`: $sourcePath"
  }
  $engineHashSeed += (Get-FileHash $sourcePath -Algorithm SHA256).Hash
  $relativeSources += $sourcePath.Substring($RepoRootFull.Length + 1).Replace('\', '/')
}
$engineHash = [BitConverter]::ToString(
  [Security.Cryptography.SHA256]::Create().ComputeHash(
    [Text.Encoding]::UTF8.GetBytes($engineHashSeed))).Replace('-', '').ToLowerInvariant()
@{
  abi        = [int]$Abi
  artifact   = "wasm/$ArtifactName"
  builtAtUtc = (Get-Date).ToUniversalTime().ToString('o')
  engineHash = "sha256:$engineHash"
  buildFlags = @("OPTIMIZE=-O3", "SINGLE_FILE=1", "STACK_SIZE=4MB")
  sources    = $relativeSources
} | ConvertTo-Json | Out-String | ForEach-Object {
  # UTF-8 SIN BOM: JSON.parse de Node lo exige.
  [IO.File]::WriteAllText(
    (Join-Path $WasmDir 'resynator-v2-abi.json'), $_,
    [Text.UTF8Encoding]::new($false))
}

Write-Host "Publicado en $WasmDir (abi.json actualizado)." -ForegroundColor Green
