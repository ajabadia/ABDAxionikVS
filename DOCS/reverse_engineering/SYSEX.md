# Hartmann Neuron — Especificación de SysEx, Dumps de Memoria y Arquitectura e[0xD95]

> **Propósito:** Documento canónico de referencia para la compatibilidad con el sintetizador hardware original **Hartmann Neuron (Keyboard / Rack)**, editores SysEx universales (**SoundDiver**, **MidiQuest**) y la preservación de presets y volcados de firmware.

---

## 1. Identificación y Codec SysEx Oficial del Hardware Hartmann

### 1.1 El Plugin VST2 vs. el Hardware Físico
Durante la descompilación de `NeuronVS.dll`:
- En `effProcessEvents` (`0x1000b7f0`), el dispatcher VST2 filtra estrictamente los eventos con `type == kVstMidiType` (mensajes MIDI de canal: NoteOn/Off, CC, Pitch Bend, Aftertouch) y descarta silenciosamente cualquier evento de tipo `kVstSysExType`.
- El callback `0x1000b7f0` **no implementa un manejador para el byte de estado `0xF0`**.
- **Conclusión arquitectónica:** El protocolo SysEx pertenece exclusivamente al **Hardware Hartmann Neuron (OS 1.0 .. 1.5.x)** y al subsistema de comunicación MIDI físico, no a la interfaz de automatización del plugin VST.

---

### 1.2 Cabecera Canónica SysEx (`neuron_1_5_0.mid`)
A partir del análisis exhaustivo del volcado oficial de firmware `neuron_1_5_0.mid` (compuesto por **1.626 mensajes SysEx individuales** idénticos en estructura):

```text
Offset    Byte    Descripción
──────────────────────────────────────────────────────────────────
0x00      0xF0    System Exclusive Start
0x01      0x00 ┐
0x02      0x20 ├  Manufacturer ID Extendido de 3 bytes: Hartmann GmbH (MMA ID oficial)
0x03      0x50 ┘
0x04      0x01    Model ID / Target Hardware: Hartmann Neuron Synthesizer
0x05      0x7F    Device ID: 0x7F (Omni / Broadcast de sistema) o 0x00..0x0F (Canal de dispositivo)
0x06      0x70    Command / Opcode: Firmware / System Data Stream
0x07      0x00    Sub-comando / Índice de bloque High
...       ...     Payload de datos (235 bytes en formato 7-bit seguro: todos los bytes < 0x80)
0xF2      0xF7    End of Exclusive (EOX)
```

#### Características del Transporte:
1. **Manufacturer ID:** `0x00 0x20 0x50` (Hartmann Music / GmbH registrado formalmente ante la MIDI Manufacturers Association).
2. **Payload:** 235 bytes por paquete, garantizando compatibilidad con buffers MIDI estándar de hardware (FIFO de 256 bytes) sin riesgo de desbordamiento de búfer.
3. **Checksum:** Tras evaluar los 1.626 mensajes con los 5 algoritmos habituales (suma módulo 128, complemento a 2 estilo Roland, XOR longitudinal, CRC-7, parity nibble), los valores de cola se distribuyen uniformemente: **este flujo de actualización directa de firmware no implementa checksum en el wrapper SysEx**, confiando la integridad al framing y al protocolo de capa de aplicación NUX.
4. **Formato NUX de Modelos (80 GB):** Para la transferencia masiva de modelos neuronales (archivos `.sphere` / `.scape`), el hardware emplea el contenedor **NUX** (cabecera de 224 bytes con identificadores `csAN` / `psAN`, compresión `zlib raw` y firma SHA-256 truncada a 16 bytes), documentado en `Neuron80GB-OS15/tools/`.

---

## 2. Presets de Fábrica y Valores por Defecto

### 2.1 Tabla Canónica de Descriptores (.rdata)
- **Ubicación en el binario:** Offset absoluto `0x10049F08`.
- **Estructura:** Array contiguo de **445 descriptores de parámetros** de 28 bytes (`0x1C` B) cada uno:
  ```cpp
  struct SndDatParamDesc {
      uint32_t index;       // 0 .. 444
      const char* name;     // Puntero a cadena ASCII en .rdata
      const char* group;    // Categoría ("Synth", "Master", etc.)
      float min;            // Cota inferior física
      float max;            // Cota superior física
      float defaultValue;   // Valor de fábrica inicial
      float step;           // Resolución de cuantización (típicamente 1.0)
  };
  ```
- **Extracción:** La totalidad de estos 445 registros se encuentra volcada y preservada en `schemas/preset_schema.csv` y autogenerada en `Source/Generated/ParameterRegistry.gen.h`.

### 2.2 Presets Embebidos vs. Presets en Disco
- El binario `NeuronVS.dll` **no contiene los 1.000 presets serializados como blobs binarios**. Delega el almacenamiento de sonidos en la jerarquía de archivos del disco:
  `NeuronDB/Sounds/{000..999}.sound/sound.script`
- Al inicializarse el motor, el constructor de la tabla de presets (`0x10013ea0`) siembra los 1.000 slots de nombres de programa con la cadena canónica `InitSound` (offset de cadena `0x100525BC`) y asigna a cada parámetro su `defaultValue` extraído de la tabla de descriptores de `.rdata`.
- **Interfaz VST2 (`dispatcher`):**
  - La llamada `effGetProgramName` copia la cadena estática `"No Program Name"`.
  - La llamada `effGetProgramNameIndexed` devuelve `0` (el plugin no expone la lista de 1.000 programas vía la API VST2 estándar de Steinberg, sino que la gestiona internamente o mediante su GUI nativa).

---

## 3. Arquitectura Interna de `e[0xD95]` (`CSilverRack`)

En el motor DSP de Neuron (`NeuronVS_dsp`), el array de estado global del motor `engine[]` alberga en el offset `0xD95` el sub-objeto completo **`CSilverRack`**.

### 3.1 Punteros y Funciones Descompiladas Clave
- **Actualización de parámetros:** `FUN_100343e4` (`CSilverRack::UpdateParams`)
  - Recibe el snapshot de los parámetros `p[249..316]` (correspondientes a los índices Silver Filter, FreqFX y TimeFX).
  - Vuelca 54 valores literales y calcula 10 coeficientes intermedios derivados (frecuencias de corte en radianes normalizados, ganancias en dB convertidas a factores lineales y constantes de tiempo).
- **Procesamiento de audio:** `FUN_10029e34` (`CSilverRack::Process`)
  - Ejecuta la cascada en serie: **Multimode Filter** (biquad conmutable 24/12/6 dB) $\rightarrow$ **FreqFX** (EQ 4-Band / Distorsión / RingMod / Decimator / Spectral Warp) $\rightarrow$ **TimeFX** (Stereo Spread / Delay / Flanger / Phaser / Chorus).

### 3.2 Layout de Memoria de `CSilverRack` (0x843C8 Bytes)
Detallado en `DOCS/reverse_engineering/dsp/ZONES.md` §6.5:
```text
Offset Relativo   Tamaño        Descripción
──────────────────────────────────────────────────────────────────────────
+0x00000          0x0000C       VTable y flags de habilitación (bypass / enable)
+0x0000C          0x00104       Cabecera de 64 Dwords (parámetros y coeficientes calculados)
                                (+0x0C .. +0x110; el offset +0xC8 permanece intacto)
+0x00114          0x2B138       Línea de retardo 1 (Buffer circular de audio float32)
+0x02B24C         0x2B138       Línea de retardo 2 (Buffer circular canal derecho)
+0x056384         0x2B138       Buffer circular auxiliar / modulador LFO
+0x081508         0x0004C       Tabla de 20 punteros a funciones de interpolación y mezcla
+0x0815C8         Puntero       Sub-objeto de filtros de ecualización (Biquad Bank)
+0x0815CC         Puntero       Sub-objeto de procesado dinámico (Compressor / Limiter)
──────────────────────────────────────────────────────────────────────────
Tamaño total: 0x843C8 bytes (~541.640 bytes)
```

---

## 4. Hoja de Ruta para la Compatibilidad de Dumps SysEx

Para cuando se implemente en el futuro el soporte completo de **Sound Dumps bidireccionales** con el hardware:
1. **Header de Recepción/Transmisión:** Utilizar siempre el prefijo canónico verificado:
   $$\text{SysEx Header} = \mathtt{0xF0\ 0x00\ 0x20\ 0x50\ 0x01\ [DeviceID]\ [Opcode]}$$
2. **Empaquetado de los 445 Parámetros:**
   - Para transportar enteros de hasta 14 bits con signo (`-200 .. +600`), aplicar el empaquetado continuo **7-to-8 bits** de `abd::hw::SysExCodec` o la pareja de nibbles (`LSB / MSB`).
3. **Captura Pendiente:** Para obtener la matriz de opcodes específica de sonido (`Sound Dump Request`, `Sound Dump Send`), se necesitará un volcado `.syx` capturado de una sesión real con el teclado Neuron o la definición de SoundDiver.
