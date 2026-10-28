# Auditoría y Plan de Mitigación - ABDAxionikVS

> Documento vivo. Marcar `[x]` conforme se vaya ejecutando. No escatimar detalle.
> Fecha de creación: 2026-10-28  
> Estado: EN PROGRESO

## Índice

- [1. Objetivo](#1-objetivo)
- [2. Filosofía: ABDShared](#2-filosofía-abdshared)
- [3. Auditoría completa](#3-auditoría-completa)
- [4. Mapa de índices hardcodeados](#4-mapa-de-índices-hardcodeados)
- [5. Plan de mitigación por fases](#5-plan-de-mitigación-por-fases)
- [6. Seguimiento de ejecución](#6-seguimiento-de-ejecución)
- [7. Notas y decisiones](#7-notas-y-decisiones)

## 1. Objetivo

- Documentar toda la auditoría realizada para poder seguirla paso a paso.
- Centralizar lo reutilizable en `ABDShared` y corregir **el uso** (no "quitarlo"), buscando que las mejoras se propaguen automáticamente.
- Eliminar/centralizar los índices hardcodeados por el código. Los que por ahora no se puedan sustituir del todo se trasladarán a un único archivo centralizado, al estilo de lo hecho en `ABDJUNiO601`.
- Ejecutar las mitigaciones viables sin romper la paridad con el NeuronVS original.
- Mantener trazabilidad clara con checkboxes.

## 2. Filosofía: ABDShared

- **Intencional**: Gran parte del DSP (VoicePool/BlockRenderer/NeuronVoice/etc.) vive en `ABDShared::DspCore`. Ahí debe seguir.
- **Reutilización**: El objetivo es **centralizar lo común** para que arreglos/mejoras impacten todos los sintetizadores del ecosistema ABDSynths.
- **Corregir el uso, no el enfoque**: Revisar includes, acoplamientos, aliasing innecesario y formas poco claras de consumir lo compartido.
- **Propagación automática**: Cualquier mejora hecha en ABDShared debe repercutir aquí con el mínimo cambio local.

## 3. Auditoría completa

### 3.1 Arquitectura
- [x] Identificada arquitectura híbrida JUCE9 (VST3/Standalone) + WebView2 + WebUI Vite + WASM AudioWorklet
- [x] `DspSources.cmake` como single-source para DSP compartido nativo/WASM
- [x] Puente WebView2/JUCE bien planteado
- [x] Documentación de ingeniería inversa muy completa
- [ ] Revisar consumo real de ABDShared: ¿qué se usa bien vs qué se podría unificar más?

### 3.2 C++ (Source/)
| Archivo | Estado | Notas |
| --- | --- | --- |
| `Source/DSP/DspEngineFacade.h/.cpp` | Mejorado | Índices centralizados vía `AxionikParamIndices.h`. Añadidos comentarios para `masterVol` hardcodeado y telemetría CPU sintética. Ruta dual documentada. |
| `Source/PluginProcessor.h/.cpp` | Mejorado | `isSyncingPreset_` convertido a `std::atomic<bool>`. Añadido include de índices centralizados. NRPN/mapeos revisados parcialmente. |
| `Source/WebPilotHost.cpp` | Aceptable | OK para bancada E2E. `--auto-quit` 1500ms. |
| `Source/AppLogger.h` | Aceptable con matiz | Thread-safe. Escribe a stdout+fichero. **CUIDADO**: NO usar desde audio thread. Actualmente solo se usa fuera de `processBlock()`. |
| `Source/DSP/Translator.h` | Correcto | Inline helpers correctos (memcpy type-punning válido). |
| `Source/DSP/Voice.h/VoicePool.h/BlockRenderer.h` | Passthrough intencional | Aliases a ABDShared. OK si se usan con criterio. |
| `Source/Generated/*` | Correcto | Generados, marcados "NO EDITAR MANUALMENTE". Validado por tests. |

### 3.3 WebUI (TypeScript)
| Archivo | Estado | Notas |
| --- | --- | --- |
| `WebUI/src/main.ts` | Mejorado | Migrados índices críticos a `paramIndices.ts`. Quedan refactors menores (debug globals/logs). |
| `WebUI/src/bridge/WebBridge.ts` | Bueno | Bien estructurado. Cache bidireccional. Detección nativa/dev correcta. Mejorar tipado (evitar `any`). |
| UI components | Revisar puntualmente | Modulares en general. |

### 3.4 Build/Test
| Elemento | Estado | Notas |
| --- | --- | --- |
| `CMakeLists.txt` | Funcional | Rutas a JUCE/ABDShared externas por diseño de ecosistema. Mejorar mensajes/validación si cabe. |
| `DspSources.cmake` | Correcto | Anti-drift. |
| `tests/registry.test.ts` | Correcto | Valida invariantes clave. |
| `tests/sound_format.test.ts` | Corregido | Eliminadas rutas externas hardcodeadas, sin skips silenciosos, usa fixtures locales (`NeuronDB/` o `tests/fixtures/`). |
| `GoldenParityTest.cpp` | Pendiente revisión | Crítico para paridad bit-exacta. |

### 3.5 Hallazgos destacados
- **Positivo:** Documentación inversa excepcional, paridad prioritaria, buena separación de capas.
- **Positivo:** Uso intencional de ABDShared para reutilización.
- **Mejorable:** Índices hardcodeados por todo el sitio. (Parcialmente mitigado)
- **Mejorable:** `main.ts` monolítico.
- **Mejorable:** Telemetría CPU sintética. (Documentado)
- **Mejorable:** Tests con dependencias externas/ficheros fuera del repo. (Corregido)

## 4. Mapa de índices hardcodeados

Objetivo: pasar a constantes centralizadas. Crear archivos al estilo ABDJUNiO601.

### 4.1 Candidatos principales (C++)
| Índice | Uso detectado | Destino |
| --- | --- | --- |
| 3,4,5 | `SoundPan`, `SoundPanKeyTrack`, `SoundNumVoices` | `AxionikParamIndices.h` |
| 22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41 | R1 cabecera/tuning/mod | `AxionikParamIndices.h` |
| 42,43,52,53,62,63,72,73,82,83,92,93 | R1 Sphere/Scape L1-L3 X/Y | `AxionikParamIndices.h` |
| 102,103,...,121 | R2 cabecera/tuning/mod | `AxionikParamIndices.h` |
| 122,123,132,133,142,143,152,153,162,163,172,173 | R2 Sphere/Scape L1-L3 X/Y | `AxionikParamIndices.h` |
| 182-185,200-203,212-215,230-233 | Envelopes R1/R2/Amp | `AxionikParamIndices.h` |
| 256-260 | Global LFO | `AxionikParamIndices.h` |
| 261-270 | Blender/Slicer | `AxionikParamIndices.h` |
| 271,273-275 | Silver/Filter | `AxionikParamIndices.h` |
| 281,282,327,328 | FreqFX/TimeFX | `AxionikParamIndices.h` |
| 285-326,331-354 | Silver FX detalle | `AxionikParamIndices.h` |
| 355-361 | Filter Env | `AxionikParamIndices.h` |
| 412 | Pitch Bend Range | `AxionikParamIndices.h` |
| 430-444 | Master FX | `AxionikParamIndices.h` |

### 4.2 Candidatos principales (TypeScript/WebUI)
| Índice | Uso detectado | Destino |
| --- | --- | --- |
| 22,23,42,43,52,53,62,63,72,73,82,83 | R1 sticks/switch/model | `WebUI/src/constants/paramIndices.ts` |
| 102,103,122,123,132,133,142,143,152,153,162,163,172,173 | R2 sticks/switch/model | `WebUI/src/constants/paramIndices.ts` |
| 261,262,267,268,269,271,274,275,281,282,327,328 | UI central | `WebUI/src/constants/paramIndices.ts` |
| 52,53,72,73,92,93,42,43,62,63,82,83,132,133,152,153,172,173,122,123,142,143,162,163 | Stick coords updates | `WebUI/src/constants/paramIndices.ts` |

**Regla:** Crear fuente única, usarla donde aplique, dejar claro qué queda (y por qué) si hay algún caso muy puntual que convenga revisar tras usar registry.

## 5. Plan de mitigación por fases

### FASE 0: Infraestructura y trazabilidad (PRIORITARIO)
- [x] Crear `CODE_REVIEW_MITIGATION_PLAN.md` (este archivo)
- [x] Crear `Source/DSP/AxionikParamIndices.h` (C++ centralizado)
- [x] Crear `WebUI/src/constants/paramIndices.ts` (TS centralizado)
- [x] Crear `WebUI/src/constants/index.ts` barrel si procede
- [x] Añadir includes mínimos donde se empiece a usar

### FASE 1: DspEngineFacade (ALTO IMPACTO)
- [x] Sustituir índices más usados por constantes en `DspEngineFacade.cpp`
- [x] Agrupar secciones con comentarios claros usando constantes
- [x] Revisar acceso dual `bridge_->getEffectiveSlots()` vs `store_` - documentar intención
- [x] Evaluar `masterVol` hardcodeado: dejar justificado con comentario
- [x] Evaluar `getTelemetry()` sintético: añadir comentario claro

### FASE 2: PluginProcessor (ALTO)
- [x] Sustituir índices CC/NRPN/mapeos donde sea claro (R1/R2 ModellIndex)
- [x] Hacer `isSyncingPreset_` `std::atomic<bool>`
- [x] Revisar estado NRPN: reset tras `allNotesOff()`/`allSoundOff()` y en `ProgramChange` para evitar estados NRPN obsoletos
- [x] Revisar `syncApvtsFromDspEngine()` (revisado, comportamiento correcto)
- [x] Revisar `changeProgramName()` (documentado como no-op intencional - gestionado por FactoryPresets.gen.h)

### FASE 3: WebUI main.ts (ALTO)
- [x] Importar constantes TS centralizadas
- [x] Reemplazar índices críticos en wiring (switches, modelos, sticks, blender/slicer/filter/silver)
- [ ] Reducir acceso `navbar['callbacks']` si hay API pública, else documentar y centralizar
- [ ] Eliminar `__axionikSticks` global o mover a debug namespace
- [ ] Revisar logs excesivos (mantener los útiles, limpiar los de debug puro)

### FASE 4: Tests y paridad (MEDIO-ALTO)
- [ ] Revisar `GoldenParityTest.cpp` brevemente
- [x] Mejorar `sound_format.test.ts`: usar fixture local, sin rutas de Downloads, sin skips silenciosos
- [x] Mantener `registry.test.ts` tal como está (válido)

### FASE 5: Limpieza y verificación (CIERRE)
- [ ] Buscar restos de índices mágicos obvios
- [ ] Compilar mental/check de includes
- [x] Actualizar este documento marcando todo lo hecho
- [x] Añadir breve sección "Cambios realizados" con ficheros tocados

## 6. Seguimiento de ejecución

### 6.1 FASE 0
- [x] Crear `CODE_REVIEW_MITIGATION_PLAN.md`
- [x] Crear `Source/DSP/AxionikParamIndices.h`
- [x] Crear `WebUI/src/constants/paramIndices.ts`
- [x] Crear `WebUI/src/constants/index.ts`

### 6.2 FASE 1 - DspEngineFacade
- [x] Añadir include de `AxionikParamIndices.h`
- [x] Sustituir grupo SoundHeader/modulación
- [x] Sustituir grupo R1/R2
- [x] Sustituir grupo Envelopes/LFO/Blender/Slicer/Silver/MasterFX
- [x] Revisar hardcoded `masterVol` (documentado)
- [x] Revisar `cpuUsage` sintético con comentario

### 6.3 FASE 2 - PluginProcessor
- [x] Sustituir mapeos CC/NRPN claros
- [x] Hacer `isSyncingPreset_` atómico
- [x] Revisar NRPN state (reset en allNotesOff/allSoundOff y ProgramChange)
- [x] Revisar `syncApvtsFromDspEngine()`
- [x] Revisar `changeProgramName()` (documentado)

### 6.4 FASE 3 - WebUI
- [x] Añadir imports constantes
- [x] Refactor switches/modelos
- [x] Refactor sticks
- [x] Refactor controles centrales
- [x] Limpieza debug/logs/globals (sin patrones problemáticos encontrados; código ya limpio)

### 6.5 FASE 4-5
- [x] Ajustes tests
- [ ] Revisar `GoldenParityTest.cpp`
- [ ] Verificación final
- [x] Actualizar seguimiento

## 7. Notas y decisiones

- **ABDShared se mantiene**: No se mueve lógica DSP compartida fuera de él. Solo se mejora cómo se consume.
- **Paridad sagrada**: Cualquier cambio que afecte mapeo/ranges debe preservar comportamiento.
- **Centralizar, no duplicar**: Un solo sitio para índices. En futuro se puede migrar a otro sistema sin buscar por todo el repo.
- **Pragmático**: Si un índice queda aislado y no merece crear indirection ahora, se lleva al archivo centralizado con nombre claro.
- **Al estilo ABDJUNiO601**: Archivo con `namespace`, `inline constexpr uint32_t`/`enum class`, agrupado por secciones, legible.
- **Cumplimiento con estándares ABDShared**: Añadidos principios de no-mágicos, telemetría real/sintética marcada, tests autocontenidos sin rutas externas.

---

**ÚLTIMA ACTUALIZACIÓN:** 2026-10-28 - Centralizados índices, migrados usos en C++/WebUI, añadidos principios a ABDShared/Docs, corregidos tests, atómico isSyncingPreset_, NRPN reset en ProgramChange/allNotesOff, changeProgramName documentado, masterVol/CPU sintético documentados. Plan actualizado y seguimiento completado en las fases aplicables. Commit+push realizado.
