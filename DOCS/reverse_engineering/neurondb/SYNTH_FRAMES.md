# El cuerpo del modelo 511 — parciales del `.sphere` frente a la curva del `.scape`

Los dos binarios del modelo contienen cosas distintas y este documento las separa
oyéndolas. El bloque de 6152 B de cada frame del `.sphere` es un **banco de 1024
parciales** (frecuencia, amplitud y bin) y el `.scape` es **un solo ciclo de 100
muestras**. Sintetizados por separado, el primero suena a cuerpo con formante y el
segundo a un seno: el timbre del modelo entero está en el `.sphere`, y el `.scape`
aporta el tono, no el color.

```bash
python NeuronVS_neurondb/tools/synth_frames.py       # escribe los tres WAV
python NeuronVS_neurondb/tools/verify_synth_frames.py  # exit 0
```

| Archivo | Qué es |
|---|---|
| [`wav/body_frame00.wav`](wav/body_frame00.wav) | los 1023 parciales del **frame 0** (el espectro completo) |
| [`wav/body_frame32.wav`](wav/body_frame32.wav) | los 132 parciales del **frame 32** (una lista de picos) |
| [`wav/scape_curva.wav`](wav/scape_curva.wav) | el **ciclo del `.scape`** tal como lo lee `FUN_100317b0`, como referencia |
| [`synth_frames.csv`](synth_frames.csv) | las medidas de los tres: nivel, cresta, centroide, bandas |

Los tres son mono, 44,1 kHz, 16 bit, 2,0 s, con 20 ms de fundido y **el mismo RMS
(−18 dBFS)**, así que la comparación es de timbre y no de volumen.

## Cómo se sintetiza

### El cuerpo

`FUN_1003bd10` / `FUN_1003c980` recorren el bloque y llenan el banco aditivo con
tres arrays paralelos. De ellos salen la amplitud y la frecuencia de cada parcial:

| Array | Offset | Uso en el render |
|---|---|---|
| `C` | `+0x1008` | **frecuencia**: `C · 44100/1024` = `C · 43,066 Hz` |
| `B` | `+0x808` | **amplitud** lineal, `B / 65535` |
| `A` | `+0x008` | el pico medido en Hz; **no** se usa (abajo, por qué) |

El motor usa el bin y no `A` en la ruta por defecto de `FUN_1003c980`
(`frecuencia = C · fVar4`), y los datos obligan a lo mismo: en el frame 32, `A`
toma sólo **121 valores distintos para 132 parciales** —los bins 20, 21 y 22
llevan los tres `880 Hz`, y los 17, 18 y 19 los tres `706 Hz`—, mientras que `C`
es único por slot. Sintetizar con `A` colapsaría tres osciladores en uno.

La rejilla de bins tiene dos consecuencias que se aprovechan aquí:

- todas las frecuencias son múltiplos exactos de 43,066 Hz, así que la suma es
  **periódica de 1024 muestras** —basta sintetizar un periodo y repetirlo, que es
  exactamente lo que hace el banco—; el verificador lo comprueba (autocorrelación
  1,000 a 1024 muestras: el periodo es ese y no otro);
- los bins 513…1023 quedan por encima de Nyquist y se pliegan, como en el motor.

Las fases son de Schroeder (sólo reparten los picos de la suma; el espectro de
magnitud es el mismo con cualquier juego de fases). La ganancia de bloque
(`+0x002`: 31.040 en el frame 0, 54.136 en el 32) se aplica como factor y luego se
cancela al igualar el RMS; en la tabla queda el RMS **bruto**, que sí la incluye.

### La curva

`FUN_100317b0` avanza la fase, interpola linealmente la tabla `int16` y devuelve
`(2 · (v[n] − v[n−1]) + v[n]) · ganancia`. El ciclo se toma del bucle
(`[31472, 62843)`), en el tramo ya estabilizado, y se le aplica esa misma
diferencia de dos puntos. El periodo se **mide** en los datos (autocorrelación:
máximo en 100, `r = 0,9998`) y coincide con la resolución de la cabecera `+0x10`.

## Qué dice cada archivo

| | frame 0 | frame 32 | curva `.scape` |
|---|---:|---:|---:|
| parciales | 1023 | 132 | 1 |
| ganancia de bloque | 31.040 | 54.136 | — |
| suma de amplitud (`B/65535`) | 5,763 | 1,997 | — |
| RMS bruto del periodo | 0,5449 | 0,7743 | 1.101,5 (int16) |
| cresta tras igualar RMS | 12,9 dB | 6,5 dB | 3,4 dB |
| centroide | 874 Hz | 880 Hz | 451 Hz¹ |
| 95 % de la energía por debajo de | 947 Hz | 904 Hz | 441 Hz |
| pico espectral | 861 Hz (bin 20) | 861 Hz (bin 20) | 441 Hz |

¹ La curva es un seno de 441 Hz; el centroide sube a 451 Hz porque el ruido de
cuantización de la tabla `int16` (amplitud 1.538, un LSB = 1/1538) deja un suelo
de −55 dB por bin a lo largo de 50 armónicos y ese suelo pesa en la media. En los
cuerpos no pasa: el redondeo a 16 bit del WAV queda unos 95 dB por debajo del pico,
así que el suelo que se mide en ellos es del propio bloque, no del fichero.

Reparto de energía (medido sobre el ciclo plegado, sin ventana):

| Banda | frame 0 | frame 32 | curva |
|---|---:|---:|---:|
| 344–688 Hz | −17,5 dB | −52,9 dB | 0,0 dB |
| 688–1376 Hz | −0,1 dB | 0,0 dB | −51,0 dB |
| 2,8–5,5 kHz | −37,5 dB | −82,2 dB | −46,4 dB |
| 11–22 kHz | −55,2 dB | −70,5 dB | −31,9 dB |

### El cuerpo es un formante en 880 Hz con una cola de 43 Hz

Los tres parciales más fuertes de los dos frames son los mismos bins **20, 21 y
22** (861, 904 y 947 Hz): el 96,6 % de la energía del frame 0 y el 99,99 % del 32
viven entre 500 Hz y 1 kHz. Lo que cambia entre frames es sólo la cola:

| Banda (máximo de `B` por banda) | frame 0 | frame 32 |
|---|---:|---:|
| 86–172 Hz | −26,4 dB | — |
| 172–344 Hz | −25,3 dB | −71,2 dB |
| 344–688 Hz | −18,7 dB | −56,9 dB |
| 688–1.376 Hz | **0,0 dB** | **0,0 dB** |
| 1.376–2.752 Hz | −28,9 dB | −63,3 dB |
| 2.752–5.504 Hz | −45,5 dB | −90,3 dB |
| 5.504–11.008 Hz | −58,3 dB | −71,2 dB |
| 11.008–22.050 Hz | −68,7 dB | −72,8 dB |

En el frame 0 la cola cae unos 13 dB por octava por encima del formante (bin 40 =
1.723 Hz a −35,3 dB, bin 80 a −49,7, bin 160 a −62,0, bin 320 a −74,7, bin 640 a
−84,3): es un peine denso, un parcial cada 43 Hz hasta 22 kHz. En el frame 32 esa
cola desaparece: el propio bin 40 queda a −75,3 dB, el 80 a −102,5 y el 160 a
−109,4. El frame es el mismo cuerpo con la cola borrada.

De ahí las diferencias al oído:

- **`body_frame00.wav`** — el cluster de 861/904 Hz (que late a 43 Hz, la
  separación entre bins) con un halo metálico de fondo, 37 dB por debajo en
  2,8–5,5 kHz y 55 dB en 11–22 kHz.
- **`body_frame32.wav`** — el mismo cluster, casi sin halo: en 2,8–5,5 kHz está
  82 dB abajo, así que suena a tono hueco con el mismo batido de 43 Hz.
- **`scape_curva.wav`** — un seno limpio de 441 Hz.

### La curva no lleva timbre

El ciclo estabilizado del `.scape` es un **seno**: su segundo armónico está 52 dB
por debajo del primero (amplitud 1.538 frente a 3,7 en la escala del `int16`), y
el residuo que queda es el propio ruido de cuantización de la tabla.

Lo único que se sale de eso es el **ataque**, los tres primeros ciclos (6,8 ms),
donde la curva sí tiene armónicos que caen como `1/n`:

| Ciclo | h1 | h2/h1 |
|---|---:|---:|
| 0 | 288,7 | 0,448 (−7,0 dB) |
| 1 | 887,9 | 0,142 (−17,0 dB) |
| 2 | 1.435,9 | 0,069 (−23,3 dB) |
| 3 a 39 (media) | 1.537,6 | 0,0029 (−50,8 dB) |

Es un fundido de entrada de la muestra analizada, no el cuerpo del sonido: pasados
3 ciclos la curva es un seno y el timbre ya sólo puede venir del `.sphere`.

### Las dos rejillas no coinciden (10,25 bins por armónico)

El formante del cuerpo cae sobre bins enteros de 43,066 Hz, y la curva tiene su
fundamental en 441,43 Hz, que son **10,25 bins**: los armónicos de la curva
(441,43 · n) sólo caen en un parcial del cuerpo cuando `n` es múltiplo de 4 (n = 4
→ bin 41 = 1.765,7 Hz). En cambio el formante (861–947 Hz) rodea los 882,9 Hz del
**segundo armónico** de la curva: el cuerpo refuerza la octava del tono que toca
la curva, no su fundamental.

## Límites

- La síntesis es **estática**: un frame no tiene envolvente propia en el bloque.
  El motor interpola dos frames (`FUN_10031950`) y suma la excitación de 4
  parciales de la tabla de 25 × 4 antes del banco aditivo; eso no está aquí.
- La ley exacta de la ganancia de bloque queda fuera: `+0x002` multiplica la
  amplitud en `FUN_1003bd10` y la variable de frecuencia en `FUN_1003c980`, y las
  constantes (`_DAT_1030d748`, `_DAT_1030d8cc`…) no están volcadas. Aquí se usa
  como factor lineal y luego se cancela al igualar el RMS.
- El render usa el bin; con `A` el frame 0 cambiaría como mucho ±2 Hz por parcial
  (error medio 1,87 Hz) pero el frame 32 perdería parciales por frecuencias
  repetidas, así que no se ofrece esa variante.
- El WAV de la curva usa incremento de fase 1,0 (el tono de análisis, 441 Hz). El
  bucle mide 31.371 muestras = 313,71 ciclos, así que el motor real, al cerrar el
  bucle, salta de fase; ese clic es del bucle, no del timbre, y se ha evitado
  repitiendo el ciclo medio.
- Nada de esto se ha ejecutado contra el plugin: es una síntesis de los datos que
  el plugin carga, no una captura de su salida.
