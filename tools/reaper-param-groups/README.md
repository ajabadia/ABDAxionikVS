# Grupos de parámetros en REAPER

El plugin publica un `juce::AudioProcessorParameterGroup` por categoría del
diccionario y el host debe verlos como **secciones/unidades** del VST3. Esta
herramienta lo comprueba en un REAPER real, sin DAW a mano y sin capturas: lee
lo que el host tiene cargado (`TrackFX_GetParamSectionName`) y lo compara con
el registro generado.

Reemplaza la sonda ReaScript que se escribió a mano para el §4.4 de
`ABDShared/Docs/specs/COMMON_DATA_DICTIONARY_AND_INTEGRATION.md`. Se puede
repetir tras cada cambio en `Source/PluginProcessor.cpp` o en el diccionario.

## Qué comprueba

- El FX se puede insertar (`ABDAxionikVS`, o el que diga `ABD_REAPER_PLUGIN`).
- Cuántos parámetros expone el host y cuántos llevan sección.
- Que **el recuento con sección coincide con `kNumTotalParameters`** de
  `Source/Generated/ParameterRegistry.gen.h` — si no coincide, o el registro
  cambió sin recompilar el VST3, o el host carga un binario antiguo.
- Que existe cada una de las secciones esperadas (`Global`, `Name`, `Synth`,
  `Resynator 1`, `Resynator 2`, `Master FX`). Las secciones nuevas de más no
  son fallo.
- Que ningún parámetro del diccionario se quedó sin grupo. Los que no tienen
  sección deben ser pseudo-parámetros de REAPER: `Bypass`, `Program`, `Wet`,
  `Delta` y las entradas `MIDI CC …` (en un proyecto limpio son 2085 de 2530).

Crea una pista desechable, apaga el FX y borra la pista dentro de un bloque de
undo: el proyecto no cambia.

## Cómo se ejecuta

**Desde REAPER** (lo normal cuando estás mirando el problema):
*Actions → Load ReaScript…* → `reaper_param_groups.lua` → *Run*. El resumen
sale en la consola y el detalle en `report.json`.

**Desde PowerShell**, para dejarlo en un guion o repetirlo tras cada build:

```powershell
powershell -ExecutionPolicy Bypass -File tools\reaper-param-groups\run-reaper-param-groups.ps1
```

Devuelve 0 si todo pasa y 1 si algo falla (o si no hubo informe), e imprime el
mismo resumen. Arranca REAPER con `-newinst -new`, así que **no toca** ninguna
sesión que ya tengas abierta, y cierra únicamente el proceso que arrancó. Con
`-Plugin` se apunta a otro sintetizador y con `-ReaperExe`/`ABD_REAPER_EXE` a
otra instalación.

Un `.lua` pasado a `reaper.exe` abre una sesión normal de REAPER y **se queda
abierta**: REAPER no tiene un modo «ejecutar script y salir». Por eso el
lanzador existe y por eso se cierra la instancia desde fuera.

## Cómo leer el informe

`report.json` trae `sections` (nombre y recuento por sección), `numParams`,
`sectioned`, `pseudoParams`, `expected` (lo que dice el registro) y `checks`
con `ok`/`detail`. El campo `ok` global es la conjunción de las comprobaciones.

| Síntoma | Qué suele ser |
|---|---|
| `recuento del registro coincide` en FALLO, con `sectioned` menor que `expected` | Parámetros nuevos en el registro sin grupo: revisa `createParameterLayout()` en `Source/PluginProcessor.cpp` y recompila |
| `sectioned` menor que `expected` y el registro no cambió | REAPER carga un VST3 anterior: comprueba la ruta VST y haz *Rescan* |
| `no se pudo insertar …` | El VST3 no está compilado o su carpeta no está en la lista de rutas VST de REAPER |
| `ningún parámetro del diccionario sin sección` en FALLO | El detalle lista los nombres que quedaron fuera de todo grupo |
| `están todas las secciones esperadas` en FALLO | Una categoría desapareció o cambió de nombre; actualiza la lista del script a la vez que el código |

## Límites

- Solo REAPER. Cubase 14 y Bitwig siguen sin comprobar: no están instalados.
- Verifica lo que el host **expone por API**, no que sus menús se vean bien.
  REAPER 7.x ordena los menús de parámetros por esa sección, pero eso no se
  comprueba aquí.
- `TrackFX_GetParamSectionName` existe desde REAPER 7.x; con builds anteriores
  el script se detiene y lo dice.
- `report.json` no se versiona (lo genera cada ejecución).

## Variables de entorno

| Variable | Para qué |
|---|---|
| `ABD_REAPER_PLUGIN` | Nombre del FX a insertar (por defecto `ABDAxionikVS`) |
| `ABD_REAPER_REPORT` | Ruta del informe JSON (por defecto, junto al script) |
| `ABD_REAPER_QUIET` | `1` = sin cuadros de diálogo; lo pone el lanzador |
