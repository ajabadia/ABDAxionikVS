# NeuronVS · llamadas virtuales resueltas

Reescritura del pseudocódigo exportado para que cada llamada por vtable muestre el método al que despacha, en lugar de `(**(code **)(*param_1 + 0x1c))()`.

**Resultado:** 137 de 188 llamadas por vtable resueltas (72.9%); ninguna queda ambigua; 51 no tienen receptor tipado (14 de ellos código inalcanzable); 0 son slots puros; 0 se rechazan por leer fuera de la tabla de su clase y 0 por no ser un slot (destino sin `+ 0xNN` o con un offset no múltiplo de 4). Las 53 llamadas por campo de puntero (`param_1 + 0xNN`, sin doble desreferencia) no son virtuales y se dejan intactas.

## Cómo se resuelve

1. **Clase del receptor.** El receptor se identifica por su forma: `*param_1` es el `this` del método; `param_1[2]` dentro de los despachadores VST2 es `core+0x08`, donde `FUN_10002b70` guarda el `C_Editor`; los campos del `this` se resuelven en el paso 4; el resto (parámetros y locales) queda sin tipo.
2. **CHA (class hierarchy analysis).** Para `*param_1` se toman la clase contenedora y **todas sus descendientes** en el modelo ([`../NeuronVS_classes/`](../NeuronVS_classes/)). Si todas las vtables posibles apuntan a la misma función en ese slot, la llamada tiene un único destino y se reescribe; si alguna lo sobreescribe, el slot sigue siendo el mismo método virtual y se nombra por su entrada en la clase estática (paso 3).
   Antes de leer ninguna vtable se comprueba la forma y la cota. La forma: un destino sin `+ 0xNN` (`*param_1`, o un campo con el offset dentro del paréntesis) no identifica ningún slot y se rechaza con `no-offset`; un offset que no sea múltiplo de 4 cae a caballo entre dos entradas de la tabla y se rechaza con `misaligned`, porque una vtable es un array de punteros. La cota: el slot tiene que caer dentro de la tabla declarada (`classes.csv`, `slots_to_next`) de la clase estática **y de cada descendiente**; si alguno no llega, la llamada se rechaza con estado `out-of-range`. Los tres rechazos ocurren sin tocar la DLL: un slot fuera de tabla no falla, lee la tabla vecina de `.rdata`, y el CHA la confirmaría como override.
3. **Slot declarado.** En una jerarquía de herencia simple las vtables conservan los índices: el slot N de un descendiente es el virtual que declara la familia y cada clase lo hereda o lo sobreescribe. [`../NeuronVS_classes/dtor_chain.csv`](../NeuronVS_classes/dtor_chain.csv) demuestra qué slot es el destructor (el 0: cuerpo del destructor y `operator_delete` bajo `flags & 1`) y que el slot 1 no lo es en ninguna de las 27 clases; la cadena de destructores, que cada clase enlaza con la de su padre, es la prueba de que hay una sola base y de que los índices se mantienen. El nombre del método declarado sólo se usa cuando está justificado en esa tabla; los demás slots con varios destinos siguen ambiguos.
4. **Excepción documentada.** `0x100030b0` y `0x10003970` son el despachador VST2 y sólo se invocan con `this = C_NeuronCore` ([`../NeuronVS_vst2/`](../NeuronVS_vst2/)); para ellos se usa el core en vez de su clase nominal en el modelo.
5. **Campos del `this`.** Cuando el receptor es un campo (`**(int **)(param_1 + 0xNN)`) su clase sale de quien lo escribe: cada tienda `*(T *)(this + NN) = <objeto recién construido>` en la familia (la clase, sus descendientes y sus ancestros, que comparten el offset) tipa el campo si todas coinciden. El mapa va en [`fields.csv`](fields.csv) con archivo y línea de cada tienda.
6. **Parámetros.** Un receptor `*param_N` (N >= 2) es un objeto que llega como argumento: su clase no está en el método sino en quien lo llama. `tools/infer_param_types.py` recorre los 1.023 ficheros del export, lee el argumento que cae en ese parámetro en cada sitio de llamada directo y lo tipa (la clase del llamador, un campo de [`fields.csv`](fields.csv), el resultado de un constructor local, o el propio parámetro reenviado, con recursión acotada). Si todas las llamadas conocidas coinciden, la llamada se resuelve por CHA sobre esa clase y la base es `param+cha`; el mapa va en [`param_types.csv`](param_types.csv) con un veredicto por parámetro.
7. **Reescritura.** `Method(receptor, args...)`, porque el original es `__thiscall`. El slot queda como comentario `/* +0xNN */` para poder volver al binario. Si el receptor es un campo que sólo recibe constantes (`dead-field` en [`untyped_calls.csv`](untyped_calls.csv)), la llamada se deja igual pero se anota como **código inalcanzable**, no como receptor sin tipo: ningún objeto vivo puede llegar a ella.

| Base | Llamadas |
|---|---|
| `cha` (hereda un único destino) | 57 |
| `cha+dispatcher` (core forzado) | 65 |
| `editor-bridge` (core+0x08) | 7 |
| `field+cha` (campo del `this`) | 5 |
| `param+cha` (parámetro tipado) | 0 |
| `cha+slot` (virtual del slot 1, nombrado por su clase) | 3 |
| ambiguas (anotadas) | 0 |
| sin receptor tipado (anotadas) | 51 |
| slot puro (purecall) | 0 |
| rechazadas por slot fuera de tabla (anotadas) | 0 |
| rechazadas por slot no alineado a 4 bytes (anotadas) | 0 |
| rechazadas por destino sin offset (anotadas) | 0 |

### Mapa de campos (8)

| Clase | Offset | Contiene | Tiendas | Evidencia |
|---|---|---|---|---|
| `C_Editor` | `0x018` | `C_Window` | 1 | `1001c0b0_C_Editor_v02_createChild.c:67` |
| `C_Editor` | `0x030` | `C_Window` | 1 | `1001c0b0_C_Editor_v02_createChild.c:77` |
| `C_NeuronCore` | `0x3d8` | `Remote` | 1 | `1001b140_C_NeuronCore_ctor.c:74` |
| `C_NeuronCore` | `0x3dc` | `SoundData` | 1 | `1001b140_C_NeuronCore_ctor.c:93` |
| `C_NeuronCore` | `0x3e0` | `Engine` | 1 | `1001b140_C_NeuronCore_ctor.c:111` |
| `C_NeuronCore` | `0x3e4` | `Noise` | 1 | `1001b140_C_NeuronCore_ctor.c:150` |
| `C_NeuronCore` | `0x3e8` | `Params` | 1 | `1001b140_C_NeuronCore_ctor.c:125` |
| `C_NeuronCore` | `0x3ec` | `C_Editor` | 1 | `1001b140_C_NeuronCore_ctor.c:211` |

## Ejemplo

`10002c90_C_RefObject_v02.c:16`

```c
(**(code **)(*param_1 + 0x18))()
C_OleRef_v06(param_1) /* +0x18 */
```

`10003390_C_AudioNode_v03.c:16`

```c
(**(code **)(*param_1 + 4))(param_2,param_3)
C_AudioNode_v01_setParameter(param_1, param_2,param_3) /* +0x04: virtual base en C_AudioNode, 1 override */
```

`10002de0_C_RefObject_v13.c:35`

```c
(**(code **)(*(int *)param_1[1] + 0x98))()
(**(code **)(*(int *)param_1[1] + 0x98))() /* +0x98: receptor sin tipo */
```

### Qué queda sin nombre (y por qué)

14 de los 51 sitios no son código vivo: su receptor es un **campo muerto**, un puntero que sólo recibe constantes en toda su familia (`dead-field` en [`untyped_calls.csv`](untyped_calls.csv)), así que la llamada no puede ejecutarse y el comentario dice `código inalcanzable` en vez de `receptor sin tipo`.

| Receptor | Llamadas |
|---|---|
| *(undefined4 *)(param_1 + 0xNN) | 20 |
| *param_2 | 10 |
| **(int **)(*(int *)(param_1 + 0xNN) + iVar1 * 4) | 6 |
| **(int **)(*(int *)(param_1 + 0xNN) + iVar3 * 4) | 4 |
| **(int **)(*(int *)(param_1 + 0xNN) + iVar2 * 4) | 2 |
| **(int **)(param_1 + 4) | 1 |
| **(int **)(param_1[0xNN] + iVar2 * 4) | 1 |
| *local_78 | 1 |
| *piStack_43c | 1 |
| *piVar1 | 1 |
| *piVar2 | 1 |
| *piVar5 | 1 |
| *piVar8 | 1 |
| *unaff_ESI | 1 |

Ninguno de estos sitios pasa por un campo de `C_NeuronCore`: los seis componentes del core (`0x3d8`–`0x3ec`, en [`core_fields.csv`](core_fields.csv)) ya estaban tipados y sus 66 llamadas se resuelven por CHA. Lo que queda son parámetros que nunca se pasan con un tipo declarado, la lista de hijos de `C_Window` (`+0x48`, un array de punteros que sólo llena un método de vtable), los 14 sitios de punteros que **sólo** reciben constantes ([`unreachable.csv`](unreachable.csv)) y locales copiados de esos mismos campos. El motivo de cada uno de los 51 sitios está en [`untyped_calls.csv`](untyped_calls.csv), con la tienda o la llamada que lo demuestra.

### Qué le falta a cada sitio

| Motivo | Sitios | Qué significa |
|---|---|---|
| no-callers | 22 | el método sólo se alcanza por vtable (o el array sólo se llena en uno así): no hay llamada directa de la que leer el argumento |
| dead-field | 14 | el puntero sólo recibe `0` o un número en toda su familia: nunca apunta a un objeto, la llamada no se ejecuta en esta build |
| untyped-setter | 6 | el campo se escribe desde un parámetro, pero quien lo escribe tampoco tiene llamadas directas (o recibe handles) |
| contradiction | 1 | el constructor recibe handles GDI en sus llamadas y se usa como objeto: prototipo y llamadores no concuerdan |
| local-field | 2 | el local se copia de un campo sin tipo |
| local-array | 1 | el local sale de un elemento del array de hijos |
| local-call | 2 | el local es el retorno de una función que no tiene clase en el modelo |
| local-unknown | 1 | el local no tiene asignación visible en el cuerpo |
| register-untyped | 1 | el receptor es un registro vivo, sin local que lo respalde |
| field-never-written | 1 | ninguna función de la familia escribe ese offset |

### Los parámetros (`*param_2`) no se pueden tipar en este binario

`param+cha` está a 0 porque el análisis de los 18 parámetros `*param_N` con receptor de vtable da **ninguno consistente**: 7 de esos métodos no tienen ni una llamada directa (sólo existen como entrada de vtable, y sus sitios de llamada son indirectos, así que el argumento no está a la vista), y el constructor con más llamadas recibe un `HDC` en las suyas. El detalle por función está en [`param_types.csv`](param_types.csv): `consistent`, `mixed`, `contradiction`, `null-only`, `no-callers` o `unknown`, con la evidencia en cada fila. Las 10 llamadas de esta vista se siguen anotando con `receptor sin tipo`, que es la verdad.

## Los despachos del slot 1

Los 3 sitios que quedaban ambiguos llaman al slot 1, no al destructor. `../NeuronVS_classes/dtor_chain.csv` reconstruye la cadena de destructores de las 27 clases y con ella el reparto de los dos primeros slots: el 0 es el destructor escalar (dos parámetros, el cuerpo del destructor y `operator_delete` cuando `param_2 & 1`), y el 1 es el primer método virtual, que no tiene forma de destructor en ninguna de las 27 clases. Por eso el CHA veía destinos distintos: no son destructores rivales, son las implementaciones del mismo virtual en cada tipo.

| Sitio | Virtual | Declarado en | Override | Por qué |
|---|---|---|---|---|
| `10003390_C_AudioNode_v03.c:16` | `C_AudioNode_v01_setParameter` | `C_AudioNode` | `C_NeuronCore_v01_setParameter` | slot 1 es el stub vacío 0x100033d0, el `setParameter` de la cadena |
| `10004d80_C_UiRect_v02.c:16` | `C_UiRect_v01_paint` | `C_UiRect` | `C_GraphEditor_v01_paint`, `C_ParameterPage_v01_updateStatus`, `C_UiContainer_v01_paint`, `C_UiControl_v01_paint`, `C_UiPanel_v01_paint` | slot 1 es `purecall`: lo declara puro y cada widget lo implementa |
| `10007d60_C_UiRect_v05.c:20` | `C_UiRect_v01_paint` | `C_UiRect` | `C_GraphEditor_v01_paint`, `C_ParameterPage_v01_updateStatus`, `C_UiContainer_v01_paint`, `C_UiControl_v01_paint`, `C_UiPanel_v01_paint` | slot 1 es `purecall`: lo declara puro y cada widget lo implementa |

El nombre es el de la entrada del slot en la clase estática, no el del destino: por eso `calls.csv` conserva en `candidates` las implementaciones que puede tomar el tipo dinámico y en `model_name` el nombre del puntero que contiene el slot, que el export ya escribe con el verbo de su clase (`slot1_names.py`). La evidencia completa de cada nombre, con las direcciones de las implementaciones, está en la columna `slot1_evidence` de `dtor_chain.csv`.

## Alias de nombres

El slot 0 es el destructor escalar y el slot 1 el primer método virtual, y el export ya los nombra así: `slot1_names.py` da el verbo de cada clase (`paint`, `getRect`, `setParameter`, `AddRef`, `updateStatus`) y `rename_map.csv` lo lleva a Ghidra, de modo que las 25 familias con slot 1 declarado no necesitan alias en la vista resuelta. Queda uno, porque el mapa de renombrado sólo nombra los dos primeros slots de cada tabla; la vista resuelta lo usa y `calls.csv` conserva `model_name`:

| Dirección | Alias | Nombre del modelo | Evidencia |
|---|---|---|---|
| 0x1001ba30 | C_NeuronCore_v02_getParameter | C_NeuronCore_v02 | AEffect->getParameter (stub 0x10002f30) |


## Verificación

`tools/verify_resolved.py` vuelve a leer `NeuronVS.dll` y el modelo de clases para re-derivar cada fila (contenido del slot y CHA), sin usar el resolvedor, y además deshace las reescrituras para comprobar que cada archivo es el export original con **sólo** esos cambios. Sale con 0 si todo cuadra.

El resolvedor no publica ninguna lectura fuera de tabla: antes de leer una vtable contrasta el slot con `slots_to_next` de la clase estática y de cada descendiente, y si alguna tabla no llega devuelve `out-of-range` con las clases que se quedan cortas. La comprobación ocurre antes de tocar la DLL, así que ninguna fila puede depender del verificador para ser legal.

`tools/verify_vtable_bounds.py` vuelve a derivar esa cota sin usar el resolvedor: que cada fila `resolved` lea **dentro** de la tabla de su clase, que `vtable + slot` contenga exactamente el método nombrado, que no haya slots puros y que cada fila `out-of-range` tenga, en su familia, una tabla que de verdad no llega a ese slot. También cuadra `index.csv` con `calls.csv` y publica el hueco de slots que le queda a cada clase.

El mismo verificador contrasta las anotaciones de alcanzabilidad: cada sitio marcado `código inalcanzable` tiene que ser un `dead-field` del informe de cobertura, y ningún `dead-field` puede quedarse como `receptor sin tipo`. [`unreachable.csv`](unreachable.csv) publica esos mismos sitios con el campo muerto y **todas** las tiendas que lo prueban —ruta, línea y valor, sobre el export de `NeuronVS_classes/functions/`—: si una sola escribiera un objeto, la llamada dejaría de ser inalcanzable y el verificador falla. La columna `line` de ese CSV, como la de `calls.csv`, apunta al archivo publicado, y las rutas de `stores` van desde la raíz del proyecto.

`tools/verify_resolve_bounds.py` prueba los tres guardianes del resolvedor sin creerse `calls.csv`: un slot dentro de la familia sigue resolviendo; `C_Widget+0x1c` (1 slot declarado, mientras `C_Rect` declara 32) y `C_NeuronCore+0x400` se rechazan por cota; `*param_1 + 0x19` se rechaza por alineación aunque su vecino `+0x18` resuelva, y `*param_1` se rechaza por no nombrar offset. En los tres casos `u32` está sustituido por una bomba, así que ninguna lectura de la DLL ocurre antes de la comprobación; y cada fila publicada cumple el límite de su clase y tiene un slot alineado.

`tools/infer_param_types.py --check` falla si [`param_types.csv`](param_types.csv) o [`untyped_calls.csv`](untyped_calls.csv) no se corresponden con el export: ni el mapa de parámetros ni el informe de cobertura pueden quedar desfasados respecto a las llamadas que los justifican.

`tools/verify_resolved.py` comprueba además el informe de cobertura: que cubre **exactamente** las filas `unresolved` de `calls.csv` (ninguna de ellas resuelta), que cada motivo es de la lista cerrada y que un motivo `dead-field` se sostiene releyendo **todas** las tiendas de ese offset en la familia: si una sola no es una constante, falla.

## Artefactos

| Archivo | Contenido |
|---|---|
| [`functions/`](functions) | los 342 `.c` con las llamadas reescritas |
| [`calls.csv`](calls.csv) | las 188 llamadas por vtable: receptor, slot, clase, método, base y estado |
| [`fields.csv`](fields.csv) | los 8 campos tipados: clase, offset, objeto que guardan y evidencia |
| [`param_types.csv`](param_types.csv) | los parámetros `*param_N`: sitios de llamada, veredicto, clase y evidencia |
| [`untyped_calls.csv`](untyped_calls.csv) | los 51 sitios sin receptor tipado y el motivo de cada uno |
| [`unreachable.csv`](unreachable.csv) | los 14 sitios marcados inalcanzables: campo muerto y las tiendas constantes que lo prueban |
| [`../NeuronVS_classes/dtor_chain.csv`](../NeuronVS_classes/dtor_chain.csv) | la cadena de destructores y el slot 1 de cada clase, que justifica los nombres de `cha+slot` |
| [`core_fields.csv`](core_fields.csv) | el layout de `C_NeuronCore`: offset, ancho, tipo de contenido y dónde se escribe |
| [`index.csv`](index.csv) | las 342 funciones: dirección, método, alias y archivo |
| [`summary.txt`](summary.txt) | recuento por clase y por estado |
| [`tools/`](tools) | resolvedor, inferencia de parámetros y los tres verificadores |

## Límites

- El destino es único **bajo el modelo de clases**: si un objeto de una clase no modelada llegara a ese `this`, el nombre podría no ser el suyo.
- El rechazo por cota usa el tamaño declarado en `classes.csv`; si el modelo declarara una tabla más corta que la real, la llamada quedaría `out-of-range` aunque el slot existiera. `verify_vtable_bounds.py` contrasta esos tamaños con las vistas de `vtables.csv` y con el contenido real de `.rdata`.
- Un slot con varios destinos se nombra por su clase estática sólo cuando `dtor_chain.csv` le da nombre; eso presupone herencia simple, que es lo que la propia cadena de destructores comprueba (una base por clase, llamada con el mismo `this`). Si alguna clase tuviera una base virtual o el modelo se ampliara, el slot dejaría de identificar al método y la fila tendría que volver a ambiguas.
- Las 51 llamadas sin receptor tipado son de tres formas: `*param_2` y demás parámetros (objeto recibido como argumento, sin clase declarada), variables locales (`*piVarN`, `*unaff_ESI`) y campos cuyo tipo no consta; estos últimos son los que `fields.csv` no puede tipar porque ninguna familia escribe en ese offset. Se anotan con `receptor sin tipo`, salvo los 14 cuyo campo sólo recibe constantes: ésos se anotan `código inalcanzable` y su evidencia está en [`unreachable.csv`](unreachable.csv).
- El mapa de campos sólo ve las tiendas que el export muestra como `*(T *)(this + NN) = <var>` con `<var>` asignada antes a un constructor del modelo; un campo escrito desde otra función sin nombre propio queda sin tipo aunque el objeto sea conocido.
- Los tres métodos con alias cambian también de nombre de archivo (`1001ba00_C_NeuronCore_v01_setParameter.c`, etc.) para que el nombre del sitio de llamada y el de la definición coincidan; `index.csv` guarda el nombre del modelo y `calls.csv` conserva `model_name`.
- Las llamadas a través de campos que guardan punteros a función (`param_1 + 0xb8`, etc.) no son vtables y no se tocan.
- Un receptor `*param_N` sólo se tipa si **todas** sus llamadas directas coinciden en una clase. En este binario no ocurre: los métodos que lo usan no se llaman nunca de forma directa (sus llamadas son indirectas y el argumento no aparece), o el llamador pasa un handle. Por eso `param+cha` está a 0 y no se ha inventado ningún tipo para rellenarlo.
- La reescritura cubre las 342 funciones del modelo de clases (241 llamadas indirectas). El export completo tiene 1023 funciones: las 681 restantes no tienen clase contenedora, así que su `*param_1` no se puede tipar y quedan fuera de esta vista.
- El pseudocódigo sigue sin ser recompilable: tipos inferidos, `param_N` sin nombre y prototipos ausentes.
- No se modificó el proyecto de Ghidra; la vista resuelta es un post-proceso del export, reproducible con `tools/resolve_vtable_calls.py`.
