# Prueba manual: un arrastre = un gesto de automatización (REAPER)

> **Qué comprueba:** que un arrastre continuo en la WebUI llega al host como **un solo gesto** (`beginChangeGesture`/`endChangeGesture`): se graba una rampa con dos puntos, no una escalera, y un único `Ctrl+Z` deshace el movimiento completo.
> **Duración:** ~5 minutos. **Host:** REAPER x64. Los pasos equivalentes en Cubase y Bitwig no están probados.

---

## 0. Prerrequisito bloqueante (leer antes)

En el árbol actual **la prueba va a fallar**: `openGestureFlags_` se declara como `std::vector<uint8_t> openGestureFlags_{}` (`Source/PluginProcessor.h:122`) y **nunca se dimensiona**, así que la guarda `index >= openGestureFlags_.size()` de `beginParameterGestureByIndex` / `endParameterGestureByIndex` (`Source/PluginProcessor.cpp:272` y `284`) descarta todos los gestos. Sin `beginChangeGesture`, el host no agrupa nada: graba una escalera y cada `Ctrl+Z` deshace un trozo.

Arreglo de una línea, en el constructor (`Source/PluginProcessor.cpp:76`):

```cpp
openGestureFlags_.assign(kNumTotalParameters, 0);
```

Sin ese arreglo compilado, el resultado esperado de esta prueba es el de la columna «fallo» de §4. Si aparece exactamente ese síntoma, no es un fallo del host ni de la WebUI.

---

## 1. Preparar el plugin

1. Compilar: `cmake --build build --config Release --target ABDAxionikVS_VST3`.
2. En REAPER: *Options → Preferences → Plug-ins → VST* → **Edit path list** → añadir
   `D:\desarrollos\ABDSynths\ABDAxionikVS\build\ABDAxionikVS_artefacts\Release\VST3`
   (o copiar `ABDAxionikVS.vst3` a `C:\Program Files\Common Files\VST3`).
3. *Rescan*. Insertar **ABDAxionikVS** en una pista nueva y abrir su interfaz (botón UI del plugin).
4. Cerrar cualquier otra instancia del plugin en el proyecto: la prueba debe usar una sola.

## 2. Preparar la automatización

5. Clic derecho en la pista → **Automation mode → Write**.
6. Botón de automatización de la pista (el icono de envolvente, junto a «Trim») → **FX parameters…** → *ABDAxionikVS* → **FilterFreq** (índice 274, `vstIndex` 24; es el corte del filtro) → **Show envelope**.
   - La envolvente debe quedar visible en la pista y **armada** (el `+`/`Arm` del carril).
7. Sitúa el playhead unos segundos antes y deja el transporte parado.

## 3. Ejecutar el gesto

8. **Play** (Space) y espera ~1 s para que el carril empiece a escribir.
9. En la WebUI, **un solo arrastre continuo** del control de corte (~1 s, sin soltar ni volver a pulsar). Suelta.
10. **Stop**. Vuelve a *Automation mode → Read* (o *Trim/Read*).

## 4. Criterios

| | Pasa | Falla |
|---|---|---|
| Puntos en la envolvente | **Dos** puntos útiles: uno al inicio y otro al final del arrastre, unidos por una rampa (los valores intermedios del arrastre no crean puntos sueltos) | Escalera de decenas de puntos, uno por cada actualización de la WebUI |
| `Ctrl+Z` | **Uno solo** devuelve el parámetro al valor previo al arrastre y deja la envolvente como estaba antes | Hacen falta varios `Ctrl+Z`, o el valor no vuelve |
| Valor tras deshacer | El display del control en la WebUI y el del parámetro del host coinciden con el valor anterior | La WebUI queda en el valor nuevo y el host en el viejo (o al revés) |
| Repetir 3 veces | Mismo resultado: un gesto, un undo | El número de pasos de undo varía entre intentos |

## 5. Comprobaciones extra (30 s)

* Repite en **Touch** en vez de **Write**: al soltar, la envolvente debe volver al valor previo (no quedarse escrita). Si se queda, el `endChangeGesture` no está llegando.
* Si el host muestra indicador de «parámetro en gesto» (REAPER lo refleja al tocar el control), debe encenderse **durante** el arrastre y apagarse **al soltar**.
* Un `Ctrl+Z` inmediatamente después, sin mover nada más, debe deshacer solo el gesto: si deshace también un movimiento anterior, el `begin` está llegando tarde.

## 6. Cómo distinguir las causas si falla

| Síntoma | Causa probable | Dónde mirar |
|---|---|---|
| Escalera de puntos y varios undo | Los gestos no llegan al host | `openGestureFlags_` sin dimensionar (§0); añadir traza en `beginParameterGestureByIndex` |
| Un punto por arrastre pero el undo no revierte | El `end` no se emite al soltar | `PARAM_GESTURE_END` en `WebUI/src/bridge/WebBridge.ts` y su reenvío en `PluginEditor.cpp:179` |
| La WebUI no refleja el valor tras deshacer | El host no reenvía el parámetro a la UI | Listener de `APVTS` → puente WebUI |

---

El camino de gestos no escribe hoy en `ABDAxionikVS.log` (junto al `.vst3`): si hace falta traza, va en esas dos funciones de `PluginProcessor.cpp`, no en el editor.

---

*No probado aún en hardware real: Cubase y Bitwig (sus modos de agrupación de undo son distintos; repetir §4 en cada uno antes de darlo por cerrado).*

## 7. Cobertura automática (complemento, no sustituto)

`tests/param_gesture.test.ts` (`npx vitest run tests/param_gesture.test.ts`) comprueba en jsdom que **cada control arrastrable abre y cierra el gesto de su parámetro**:

* barrido de `.abd-knob__dial`, `.abd-rotary-led__dial`, `.kbd-wheel-sprite`, `.shaper-handle-group` y `.stick-pad-circle` sobre los paneles (Filter, Blender, EnvelopeMaster, Silver, Shapers, MasterOutput, Controllers) y los drawers (NUKE, Matrix, Envelope 4L/4T, Blender, Effects/Silver, Resynator, Settings);
* los 4 macro knobs del `<NUKE>` y del Matrix, incluido el caso en que el selector de destino cambia (el gesto sigue al destino vigente);
* el pad 4L/4T y los sticks 2D, que abren **un gesto por eje** de la capa activa;
* que el `end` coincide siempre con el `begin` (nada queda abierto).

Exclusiones deliberadas, verificadas en el propio test: el volumen master (`SET_MASTER_VOLUME`), el stick de Control 1 (pitch bend / CC) y los wheels de Control 2 y 3 (`sendMidiCC`) no son parámetros del APVTS, así que **no** deben abrir gesto; los pads de curva de solo lectura (`editable: false`, como la curva ADSR de filtro) tampoco.

Límites de esa cobertura: jsdom no prueba nada de `Source/PluginProcessor.cpp` (el `openGestureFlags_` de §0 sigue siendo invisible para el test) ni el cableado de `WebUI/src/main.ts` (los cuatro sticks SCAPE/SPHERE se montan ahí y solo están verificados por compilación de tipos), ni el comportamiento real del host — para eso está §4.
