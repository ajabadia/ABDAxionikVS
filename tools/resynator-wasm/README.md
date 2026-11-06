# Resynator v2 → WASM

El motor Resynator v2 que usa la web es el **C++ real** (`AxionikExpandedSynthesizer.h`)
compilado a WebAssembly. No hay transpilación ni espejo TypeScript que mantener:
si el C++ cambia, se regenera el artefacto y listo.

## Fuente de verdad (commiteado)

- `Source/DSP/Extended/ResynatorV2Wasm.cpp` — fachada C-ABI (`RESYNATOR_V2_WASM_ABI`).
- `Source/DSP/Extended/AxionikExpandedSynthesizer.h` — el DSP.
- `Source/DSP/Extended/AxionikExpandedModel.h` — el modelo.
- `ABDNeuModMakr/public/wasm/resynator-v2-abi.json` — ABI + hash de los fuentes + flags.

## Artefacto (NO commiteado, a propósito)

`ABDNeuModMakr/public/wasm/resynator-v2-abiN.js` está en el `.gitignore` del
Makr. Un clon fresco **no suena** hasta regenerarlo: el test guardián
`tests/resynatorWasmParity.test.ts` (Makr) falla en rojo si el artefacto falta
o está obsoleto. Olvidar este script = test en rojo, nunca audio falso en
silencio.

## Regenerar (el único paso manual)

Requisitos: emsdk con `emcc` (por defecto `D:/desarrollos/emsdk`, verificado
con emcc 6.0.4; se puede sobreescribir con `$env:EMSDK`), Node.js en el PATH,
PowerShell 5.1+.

```powershell
cd tools/resynator-wasm
.\build-resynator-wasm.ps1        # o doble clic en build-resynator-wasm.bat
```

Qué hace, en orden:

1. Lee la ABI de la línea `#define RESYNATOR_V2_WASM_ABI` del wrapper.
2. Compila con emcc `-O3 -s SINGLE_FILE=1 -s STACK_SIZE=4MB` a `out/`.
   (`STACK_SIZE=4MB` no es opcional: el parser JSON del motor es recursivo y
   los documentos reales de ~100 KB agotan los 64 KB de pila WASM por defecto.
   En nativo hay 8 MB y los 16 tests C++ pasan; es ajuste de build, no del DSP.)
3. Pasa el humo (`smoke-resynator-wasm.mjs`): comprueba la ABI, carga el
   fixture, renderiza 1 s (pico + hash fnv1a) y carga un documento grande para
   vigilar el `STACK_SIZE`. Si el humo falla, **no se publica nada**.
4. Copia el artefacto a `ABDNeuModMakr/public/wasm/` y reescribe
   `resynator-v2-abi.json` (con `engineHash` SHA-256 de los tres fuentes).

## Cuándo regenerar

- Tras cualquier cambio en los tres fuentes de verdad.
- Tras subir `RESYNATOR_V2_WASM_ABI`: el artefacto pasa a llamarse
  `resynator-v2-abiN.js` y la web rechaza con error ruidoso cualquier
  artefacto con ABI distinta.

## Fixtures del humo

Viven en `ABDNeuModMakr/tests/fixtures/` (`resynator-v2-model.json`,
`resynator-v2-large.json`). Si faltan, generarlos desde el Makr:

```powershell
cd ../../../ABDNeuModMakr
npx tsx scripts/gen-resynator-golden.ts
```

Valores de referencia que imprime el humo (si cambian, el DSP cambió):

- fixture: `peak≈0.093967`, `fnv1a=86962391`
- documento grande (~98593 bytes): `peak≈0.101193`, todo finito a
  22050 / 44100 / 48000 Hz
