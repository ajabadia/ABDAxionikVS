# NeuronVS · reconstrucción de clases y vtables

Análisis estático de `NeuronVS.dll` (VST2 nativo, PE32 x86, Hartmann Music, 2004) para
reconstruir el modelo de objetos del núcleo y dar nombres significativos a las funciones
que el decompilador dejó como `FUN_xxxxxxxx`.

**Resultado:** 27 clases, 31 vistas de vtable, 10 relaciones de herencia, 10 de composición
y **342 funciones renombradas dentro de Ghidra** y reexportadas con su nombre final
(17.028 líneas de pseudocódigo).

***ZIPs actualizados:** `NeuronVS_classes.zip`, `NeuronVS_resolved.zip` y `NeuronVS_vst2.zip` ahora incluyen los nombres semánticos del slot 1 (ej. `C_Knob_v01_paint`, `C_RefObject_v01_getRect`) en sus `rename_map.csv`, por lo que los snapshots descargables llevarán nombres significativos en lugar de direcciones `FUN_10014a70`.

![Grafo de clases y vtables](class_graph.png)

## Artefactos

| Archivo | Contenido |
|---|---|
| [`class_graph.png`](class_graph.png) | Grafo de jerarquía + composición, generado sin Graphviz |
| [`class_graph.dot`](class_graph.dot) / [`class_graph.mmd`](class_graph.mmd) | Mismo grafo en Graphviz y Mermaid |
| [`classes.csv`](classes.csv) | 27 clases: vtable, ctor, tamaño de objeto, padre, bitmaps |
| [`class_edges.csv`](class_edges.csv) | Aristas `derives` / `composes` con su evidencia |
| [`vtables.csv`](vtables.csv) | 31 vistas: slots contados, vista primaria, quién la instala |
| [`components.csv`](components.csv) | Componentes no virtuales de `C_NeuronCore` |
| [`rename_map.csv`](rename_map.csv) | Mapa dirección → nombre nuevo con rol y evidencia |
| [`rename_report.csv`](rename_report.csv) | Resultado real de aplicar el mapa en Ghidra (`renamed`/`already`/`failed`) |
| [`functions.csv`](functions.csv) | Índice de las 342 funciones exportadas con su nombre final |
| [`functions/`](functions) | Un `.c` por función, con cabecera `Class:` / `Role:` / `Function:` |
| [`dtor_chain.csv`](dtor_chain.csv) | Cadena de destructores de las 27 clases: slot 0, cuerpo, enlace con la base y qué es el slot 1 |
| [`CLASSES.md`](CLASSES.md) | Catálogo clase por clase y convención de nombres |
| [`tools/`](tools) | Scripts que generan y validan todo lo anterior |

## Método

1. **Descubrimiento de vtables.** Se buscaron en el pseudocódigo las instalaciones
   `*this = &PTR_...` y se cruzaron con los punteros a función de `.rdata`
   (`0x10049000`–`0x10052000`). Aparecieron **31 vistas** distintas, algunas instaladas en
   desplazamientos secundarios del objeto (interfaces múltiples).
2. **Jerarquía.** Una arista `derives` sólo se declara si el constructor del hijo
   **llama al constructor del padre** y después instala su propia vtable. Cuando la base no
   tiene constructor propio (su ctor es trivial y quedó inlineado, como `C_OleRef`), la arista
   se prueba por los tres lados en que ese subobjeto aparece: la tabla de la base ocupa los
   primeros índices de la del hijo y al menos una entrada se hereda sin cambios; el cuerpo del
   destructor del hijo termina dejando instalada la tabla de la base; y el ctor del hijo
   registra un manejador de unwind que llama al cuerpo del destructor de la base para
   destruir el subobjeto ya construido si la construcción lanza. El script
   [`tools/verify_classes.py`](tools/verify_classes.py) vuelve a comprobar todo eso sobre el
   pseudocódigo y la DLL, de modo que la jerarquía no depende de parecidos de tabla.
3. **Composición.** Nueve widgets construyen un `C_Rect` en `+8` (`FUN_10007c80`) en lugar de
   heredar de él; se modela como `composes`, no como herencia.
4. **Núcleo.** El ctor de `C_NeuronCore` (`0x1001b140`) reserva con `operator_new` seis
   componentes no virtuales y construye el editor; de ahí sale la tabla de componentes.
5. **Nombres.** Esquema `C_<Clase>_<rol>`: `ctor`, `dtor` (slot 0), `dtorBody` (el cuerpo
   que reinstala la vtable), `v01_<verbo>` (slot 1, el primer método virtual, nombrado por su
   cuerpo: `paint`, `getRect`, `setParameter`, `AddRef`, `updateStatus`) y `vNN` para el resto
   de slots y `_<pista>` cuando el cuerpo aporta evidencia (`createChild`, `releaseGdi`,
   `paint`, `timer`). Las vistas secundarias usan `C_<Clase>_ifaceXXXX_vNN`. El papel de los
   dos primeros slots no se da por supuesto: `dtor_chain.csv` lo comprueba clase por clase
   (ver *Cadena de destructores y slot 1*).
6. **Aplicación.** `ApplyClassNames.java` renombra en el proyecto de Ghidra (idempotente:
   informa `renamed` / `already`), deja un comentario con `class`, `role` y `evidence` en cada
   función y `ExportNamedFunctions.java` vuelve a decompilar las 342 ya renombradas. El
   reporte final refleja la pasada que dio nombre semántico al slot 1: 19 `renamed` + 323
   `already` = 342 (repetirla daría 0 `renamed`), y las funciones del slot 1 quedan como
   `C_<Clase>_v01_<verbo>` en el export.

## Clases

| Clase | vtable | ctor | obj. | padre |
|---|---|---|---|---|
| `C_OleRef` | `0x10049294` | — (base sin ctor propio) | — | — |
| `C_RefObject` | `0x1004925c` | `0x10002b70` | — | `C_OleRef` |
| `C_AudioNode` | `0x100492c0` | `0x10002fb0` | — | — |
| `C_AudioComponent` | `0x100493c0` | `0x10003910` | — | `C_AudioNode` |
| `C_AudioModule` | `0x10049b60` | `0x10009f60` | — | `C_AudioComponent` |
| `C_NeuronCore` | `0x1004f550` | `0x1001b140` | 1008 B | `C_AudioModule` |
| `C_UiRect` | `0x10049604` | `0x10004950` | — | — |
| `C_UiControl` | `0x100496d8` | `0x10004ba0` | — | `C_UiRect` |
| `C_UiPanel` | `0x100497d4` | `0x10005410` | — | `C_UiControl` |
| `C_UiContainer` | `0x100498e0` | `0x10005b80` | — | `C_UiControl` |
| `C_GraphEditor` | `0x1004dea0` | `0x10014dd0` | — | `C_UiPanel` |
| `C_ParameterPage` | `0x1004e030` | `0x10015950` | 304 B | `C_UiContainer` |
| `C_Editor` | `0x1004f7a0` | `0x1001bad0` | 2820 B | `C_RefObject` |
| `C_Rect` | `0x10049a28` | `0x10007c80` | — | — |
| `C_Widget` | `0x10049a20` | `0x10006f50` | — | — |
| `C_OwnerWidget` | `0x10049a24` | `0x10007940` | — | — |
| `C_Window` | `0x10049aa8` | `0x10007e10` | — | — |
| `C_Bitmap` | `0x10049b40` | `0x100099d0` | — | — |
| `C_HitRegion` | `0x1004cfd0` | `0x10014030` | — | — |
| `C_BitmapBox` | `0x1004d188` | `0x100141a0` | — | — |
| `C_Knob` | `0x1004d21c` | `0x100145b0` | — | — |
| `C_Led` | `0x1004e20c` | `0x10016000` | — | — |
| `C_IconButton` | `0x1004e888` | `0x10016a00` | — | — |
| `C_DisplayButton` | `0x1004e940` | `0x10017470` | — | — |
| `C_PadGrid` | `0x1004ea8c` | `0x10018bb0` | — | — |
| `C_ControlPanel` | `0x1004f468` | `0x10019f20` | — | — |
| `C_EditorChild` | `0x1004f7d8` | `0x1001d200` | — | — |

## Jerarquía

```
C_OleRef ── C_RefObject ── C_Editor
C_AudioNode ── C_AudioComponent ── C_AudioModule ── C_NeuronCore
C_UiRect ── C_UiControl ─┬─ C_UiPanel ── C_GraphEditor
                         └─ C_UiContainer ── C_ParameterPage
C_Rect  (miembro en +8 de 9 widgets)
```

## Componentes de `C_NeuronCore`

Objeto de 1008 bytes que `main` construye en la pila. El ctor reserva:

| Componente | Rol | ctor | bytes |
|---|---|---|---|
| `AudioMaster` | callback al host VST | — | — |
| `Remote` | control remoto / MIDI | `0x10016790` | 4 |
| `SoundData` | tabla de parámetros `C_Param` (`snddat`) | `0x10013de0` | 12 |
| `Engine` | motor DSP | `0x10038220` | 4 |
| `Params` | árbol de parámetros | `0x1000be10` | 11.484 |
| `Noise` | generador de ruido | `0x1000b500` | 196 |
| `Editor` | raíz de la UI (`C_Editor`) | `0x1001bad0` | 2.820 |

`Params_ctor` es la función más grande de todo el binario: 29.744 bytes, 3.618 líneas.

## Cadena de destructores y slot 1

`dtor_chain.csv` recorre las 27 clases y contrasta los dos primeros slots con el DLL y el
export. `tools/analyze_dtors.py` reconstruye:

- **slot 0 — destructor escalar.** En 26 clases la entrada recibe `(this, flags)`, llama al
  cuerpo del destructor (la función que reinstala la vtable de su clase) y hace
  `operator_delete(this)` cuando el bit 0 de `flags` está puesto. `C_Bitmap` no declara
  destructor virtual: su slot 0 compara un `REFIID` y devuelve `0x80004002` (`E_NOINTERFACE`)
  y el 1 incrementa un contador — `QueryInterface` / `AddRef`.
- **la cadena.** El cuerpo de cada clase llama al de su padre con el mismo `this` (9 enlaces
  `base`); cuando la base quedó inlineada, el cuerpo termina dejando instalada su vtable
  (`inline-base`, el caso de `C_RefObject` → `C_OleRef`); los 12 enlaces `member` destruyen un
  miembro embebido (`C_Rect` en la mayoría); las 5 raíces no enlazan. La cadena coincide con
  `parent` de `classes.csv` en las 27 clases.
- **slot 1 — primer método virtual.** Ninguna de las 27 clases tiene en el slot 1 la forma de
  borrado (0 de 27), así que no es un destructor: es el primer virtual declarado por su
  familia, y cada una lo bautiza a su manera. `slot1_names.py` da el nombre al export y
  `dtor_chain.csv` lo publica: nombra el slot 1 de las 25 familias que lo declaran a partir del cuerpo de su propia
  entrada; las dos tablas de un solo slot (`C_Widget`, `C_OwnerWidget`) no tienen slot 1:
  leerlo cae en la tabla vecina y la fila lo marca `outside-table`.

| Clase | `slot 1` | Qué hace |
|---|---|---|
| `C_UiRect` | `C_UiRect_v01_paint` | `purecall`: lo declara puro y cada widget lo implementa |
| `C_UiControl` | `C_UiControl_v01_paint` | dibuja el valor formateado en el HDC (`FUN_10004de0`) |
| `C_UiPanel` | `C_UiPanel_v01_paint` | dibuja su texto en el HDC |
| `C_UiContainer` | `C_UiContainer_v01_paint` | blit del hijo seleccionado |
| `C_GraphEditor` | `C_GraphEditor_v01_paint` | blit del editor o dibuja su título |
| `C_ParameterPage` | `C_ParameterPage_v01_updateStatus` | no usa HDC: escribe la línea de estado del editor |
| `C_Rect` | `C_Rect_v01_paint` | vacío: sólo limpia el flag de repintado `+0x30` |
| `C_HitRegion` | `C_HitRegion_v01_paint` | hereda el paint vacío de `C_Rect` |
| `C_EditorChild` | `C_EditorChild_v01_paint` | hereda el paint vacío de `C_Rect` |
| `C_Window` | `C_Window_v01_paint` | fondo + `slot 1` de cada hijo |
| `C_BitmapBox` | `C_BitmapBox_v01_paint` | blit del bitmap de la caja sobre su rect |
| `C_Knob` | `C_Knob_v01_paint` | fotograma del filmstrip + valor en la línea de estado |
| `C_Led` | `C_Led_v01_paint` | LED `11300` encendido o apagado |
| `C_IconButton` | `C_IconButton_v01_paint` | icono + fotogramas sombreados |
| `C_DisplayButton` | `C_DisplayButton_v01_paint` | pantalla `11500` + icono `11501` |
| `C_PadGrid` | `C_PadGrid_v01_paint` | matriz `11410` + marcos `11400`/`11401` |
| `C_ControlPanel` | `C_ControlPanel_v01_paint` | fondo del panel |
| `C_OleRef` | `C_OleRef_v01_getRect` | default: escribe un rect nulo en el puntero de salida y devuelve 0 |
| `C_RefObject` | `C_RefObject_v01_getRect` | sobreescribe el default: escribe `&this->rect` (`+0x10`) y devuelve 1 |
| `C_Editor` | `C_Editor_v01_getRect` | hereda el `getRect` de `C_RefObject` |
| `C_AudioNode` | `C_AudioNode_v01_setParameter` | stub vacío `0x100033d0` |
| `C_AudioComponent` | `C_AudioComponent_v01_setParameter` | hereda el stub |
| `C_AudioModule` | `C_AudioModule_v01_setParameter` | hereda el stub |
| `C_NeuronCore` | `C_NeuronCore_v01_setParameter` | `0x1001ba00`, objetivo del stub VST2 `0x10002f50` |
| `C_Bitmap` | `C_Bitmap_v01_AddRef` | incrementa `+4`; `QueryInterface`/`Release` a los lados |

La evidencia completa de cada nombre, con la dirección de su entrada y la de sus overrides,
está en la columna `slot1_evidence` de `dtor_chain.csv`.

## La jerarquía `C_OleRef` / `C_RefObject`

Durante varias pasadas `C_OleRef` figuró como raíz independiente y el destructor de
`C_RefObject` la delataba como base (`agrees=no`). La arista se cerró al reunir cuatro
pruebas que apuntan en el mismo sentido:

1. **La tabla es un prefijo.** `0x10049294` (`C_OleRef`, 11 slots) ocupa los mismos índices
   que los 11 primeros de `0x1004925c` (`C_RefObject`, 14 slots), y las entradas 3, 5 y 6
   son literalmente la misma función (`0x10002d70`, `0x10002d70`, `0x10002db0`): herencia
   simple, no dos jerarquías paralelas.
2. **El destructor del hijo deja la tabla del padre.** El cuerpo `0x10002c10` de
   `C_RefObject` reinstala su propia vtable, llama a `OleUninitialize` y termina escribiendo
   `0x10049294`; en MSVC la última vtable que queda instalada al destruir es la de la clase
   más base.
3. **El ctor del hijo destruye el subobjeto base si lanza.** `0x10002b70` registra el
   manejador de unwind `0x100479b8`, que llama a `0x10002ce0`; ese cuerpo —hoy
   `C_OleRef_dtorBody`— reinstala `0x10049294`. Sólo existe un destructor de base para
   llamar si la base ya se construyó.
4. **Nadie construye `C_OleRef` aparte.** Ningún ctor instala `0x10049294`; la tabla aparece
   únicamente al destruir. Su ctor es trivial y quedó inlineado en el del hijo, por eso
   `classes.csv` deja su columna `ctor` vacía y no hay llamada que verificar.

La consecuencia práctica es que el CHA de [`../NeuronVS_resolved/`](../NeuronVS_resolved/)
considera a `C_RefObject` y `C_Editor` descendientes de `C_OleRef`, y el slot 1 de la base
recibe el nombre `getRect`: el default que `C_RefObject` sobreescribe con el rect del editor.
No queda ninguna discrepancia entre `classes.csv` y `dtor_chain.csv` (`agrees=yes` en 26
clases, `n/a` en `C_Bitmap`, que no declara destructor virtual).

Este reparto es lo que permite nombrar los tres despachos del slot 1 que quedaban ambiguos en
[`../NeuronVS_resolved/`](../NeuronVS_resolved/): no eran destructores rivales, eran las
implementaciones del mismo virtual en cada tipo; sus overrides están en
[`../NeuronVS_resolved/README.md`](../NeuronVS_resolved/README.md).

## Verificación

`tools/verify_classes.py` (exit 0, 0 problemas) comprueba:

- cada arista `derives` tiene un ctor hijo que llama al ctor padre en el pseudocódigo; en las
  bases sin ctor comprueba el prefijo de tabla, una entrada heredada en el mismo índice, que el
  unwind del ctor llame al cuerpo del destructor de la base y que el destructor del hijo deje
  su tabla instalada;
- ninguna clase comparte vtable primaria con su padre;
- el mapa de renombrado no tiene direcciones ni nombres duplicados (`rename_collisions.csv` vacío);
- las 342 filas del reporte de Ghidra están en estado `renamed`/`already` (0 `failed`);
- las 342 filas de `functions.csv` tienen su archivo y su cabecera `// Function:` correcta;
- las 31 vistas de `classes.csv` existen en `vtables.csv`.
- cada fila de `dtor_chain.csv` se re-deriva del DLL: los dos slots, el tamaño de la tabla, la
  forma de borrado del slot 0, el cuerpo que reinstala la vtable, la cadena de `classes.csv`,
  el enlace con el padre y que el slot 1 no tiene forma de destructor; las clases sin
  destructor virtual y los virtuales del slot 1 con nombre están en listas cerradas, y no se
  admite ninguna discrepancia entre `classes.csv` y la cadena de destructores.

`tools/verify_vtable_bounds.py` (exit 0, 0 problemas) es el guardián de las cotas de
tabla, el dato del que dependen todas las resoluciones de llamadas virtuales:

- `classes.csv` y `vtables.csv` declaran el mismo tamaño para la vista primaria de cada
  clase, y cada slot declarado (las 31 vistas, 1.335 slots) contiene un puntero a una
  función del modelo o al stub `MSVCRT.DLL::purecall`;
- ninguna tabla declarada se solapa con otra y ninguna derivada es más corta que su base;
- las 137 filas `resolved` de `../NeuronVS_resolved/calls.csv` leen un slot múltiplo de 4
  **dentro de la vista contra la que se resolvieron** y el puntero de `vtable + slot` es la
  dirección del método que nombran (no basta con que el slot exista); las 3 que se nombran
  por slot son la excepción medida: su slot es justamente el virtual puro que implementan los
  overrides que citan, y cada override se comprueba en el mismo índice de su propia tabla;
- no quedan filas ambiguas; si apareciera alguna, tendría que citar candidatos que existen
  como método o símbolo, y las filas sin resolver no reclaman clase, vtable ni método;
- `index.csv` cuenta las mismas llamadas y resoluciones por archivo que `calls.csv`.

Además imprime el **hueco por clase** (slots libres por encima del slot más alto usado),
para que la siguiente resolución sepa su presupuesto antes de chocar con la tabla vecina.

## Limitaciones

- **No hay RTTI ni PDB.** `C_RefObject`, `C_Knob`, etc. son nombres *descriptivos propuestos*,
  no los nombres originales. La evidencia de cada uno está en `classes.csv`.
- **`slots_to_next` no es el número de métodos virtuales de la clase.** Las vtables están
  empaquetadas de forma contigua en `.rdata`, sin delimitadores entre clases, así que el valor
  es la distancia hasta la siguiente vtable *instalada*: una cota superior. Ejemplo:
  `C_AudioComponent` mide 145 por esa regla, pero el tramo contiguo de punteros a función que
  empieza en su vtable tiene 196, y parte de esos punteros pertenecen con seguridad a otra
  tabla intermedia. Por eso el grafo no muestra recuentos de slots.
  Consecuencia práctica: un slot leído más allá del final **no falla**, lee la tabla
  vecina, y el CHA puede confirmar como «override» un método que pertenece a otra clase.
  Por eso `resolve_vtable_calls.py` comprueba la cota **antes** de leer y rechaza la llamada
  con estado `out-of-range` si alguna tabla de la familia no llega al slot, y
  `tools/verify_vtable_bounds.py` audita después cada lectura publicada contra el tamaño
  declarado de su vista y contra el puntero que realmente hay en el fichero.
- **Roles `dtor` y del slot 1.** El slot 0 es el destructor escalar (26 de 27) y el 1 el
  primer método virtual (`dtor_chain.csv`). El export ya no usa una etiqueta posicional:
  `slot1_names.py` nombra el slot 1 de las 25 familias que lo declaran y `rename_map.csv`
  lleva esos nombres a Ghidra, así que `C_RefObject_v01_getRect` es `getRect`,
  `C_Knob_v01_paint` es `paint` y `C_Bitmap_v01_AddRef` es `AddRef`. La vista resuelta
  ([`../NeuronVS_resolved/`](../NeuronVS_resolved/)) y la superficie VST2
  ([`../NeuronVS_vst2/`](../NeuronVS_vst2/)) consumen esos mismos nombres.
- **`C_OleRef` no se instancia nunca.** Es la base de `C_RefObject` (11 slots, ctor trivial) y
  sólo aparece como subobjeto: ningún ctor instala su tabla y su nombre es descriptivo. Su
  cuerpo de destructor (`0x10002ce0`) lleva el nombre precisamente por la prueba de la
  jerarquía (es el objetivo del unwind del ctor derivado), no porque se construya.
- Las **pistas semánticas** son escasas (`createChild` 6, `releaseGdi` 3): el decompilador
  resuelve la mayoría de llamadas a la API Win32 como `(*DAT_...)()` o `FUN_*`, así que el
  resto de métodos lleva nombre posicional `vNN`.
- El pseudocódigo no es recompilable: tipos inferidos, `param_N` sin nombre y llamadas
  indirectas por vtable sin resolver.
