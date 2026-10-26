# Tipos de las 1.430 constantes: medidos, no adivinados

`constants.csv` deduce el tipo **del valor**: si los ocho bytes se leen como un
`double` razonable, escribe `f64`. Eso se equivoca de dos maneras. Un `float`
almacenado en cuatro bytes, leído como `double`, casi siempre parece un número
plausible (`3.6640000343322754` es el `double` exacto del `float` `3.664`). Y un
entero pequeño como `0x00000080`, leído como `double`, es un `double` diminuto
válido.

Este documento sustituye la conjetura por la **instrucción que carga el dato**.

## Por qué el valor engaña

Tres casos reales del binario:

| Dirección | Valor (8 B) | Instrucción | Tipo real |
|---|---|---|---|
| `0x1030A050` | `3.6640000343322754` | `fld dword ptr […]` | **f32** |
| `0x1030A068` | `0.007812501943590178` | `fld dword ptr […]` | **f32** (1/128) |
| `0x1030A070` | `0.007812501848093234` | `fld dword ptr […]` | **f32** (1/128) |

Los tres parecían `f64` y los tres son `float`. El tercero es especialmente
importante: **1/128** es la normalización del bloque interno de 128 muestras, y
confundir su ancho cambia el sonido.

## Método

[`tools/sweep_constant_types.py`](tools/sweep_constant_types.py) desensambla
`.text` **una sola vez** (292.272 B, 87.519 instrucciones con capstone en modo
`skipdata`) y recoge tres formas de referencia:

1. **Directa**: operando `[disp32]` sin base ni índice, o inmediato.
2. **Diferida**: `[reg+disp]` cuando `reg` recibió antes una dirección con
   `mov reg, imm32`, `lea reg, [disp32]` o `add/sub reg, imm` — el patrón que
   usa el binario (`mov eax, 0x10054fa0; add eax, 0x8c`). El mapa se invalida en
   cuanto la instrucción escribe el registro (`regs_access`).

Cada referencia se clasifica por **familia y ancho**:

| Instrucción | Ancho | Tipo |
|---|---|---|
| `fld` / `fbld` | 8 / 4 / 10 | `f64` / `f32` / `f80` |
| `fild` | 4 / 8 | entero (carga y convierte: no es float) |
| `movsd`, `addsd`, `cvtsi2sd`, `ucomisd`, … | 8 | `f64` |
| `movss`, `addss`, `cvtsi2ss`, `ucomiss`, … | 4 | `f32` |
| `mov`, `cmp`, `add`, `test`, `push`, … | 4 | entero |
| `lea`, `mov reg, imm32` | — | dirección |

Precedencia por constante: `f80` > `f64` (sin `f32`) > `f32` (sin `f64`) >
entero dominante. Si aparecen cargas de 4 y de 8 bytes de la misma dirección, se
marca `conflict`; **no hay ningún caso** en las 1.430.

## Resultado

| | Constantes | % |
|---|---:|---:|
| Total | 1.430 | 100 |
| **Medibles por instrucción** | **708** | **50** |
| — confirman la propuesta del CSV | 402 | 28 |
| — la corrigen | 306 | 21 |
| No medibles | 722 | 50 |
| — sin carga ni dirección (`unread`) | 704 | |
| — sólo dirección (`address`) | 18 | |

`unread` significa **sin ninguna carga ni referencia de dirección**; la dirección
puede tener sitios en el binario, pero todos son almacenes (`fstp`) o instrucciones
que no dicen el ancho. `address` significa que sólo se calcula el puntero.

Las 306 correcciones, por transición:

| CSV → medido | Cuántas | Qué pasaba |
|---|---:|---|
| `f64` → `f32` | **151** | se leyeron 8 bytes; el código carga 4 |
| `u32` → `f32` | **117** | los bits parecían un entero; el código hace `fld dword`/`movss` |
| `u32` → `f64` | **31** | ídem, con 8 bytes |
| `?` → `f32` / `f64` / `u32` | 7 | constantes que el CSV no supo tipar |

Salida completa: [`constants_types.csv`](constants_types.csv), con columnas
`va, section, csv_as, value, kind, agrees, f64_loads, f32_loads, int_loads,
addr_sites, n_sites, evidence`. La columna `evidence` lleva hasta cuatro
`dirección:mnemónico/ancho` para poder comprobar cualquier fila a mano.

## Por qué la otra mitad no se puede medir

El binario pasa muchas constantes **por dirección**, no por valor:

```asm
100245EF  MOV  EAX,0x10054FA0
100245FD  ADD  EAX,0x8C          ; -> 0x1005502C
10024608  MOV  [ESP+4],EAX
10024610  CALL 0x10032630        ; el ancho lo decide el destinatario
```

En estos casos no hay ninguna carga en el sitio de la referencia: la instrucción
sólo calcula un puntero. El tipo se decide dentro de `FUN_10032630`, que recibe
el puntero como argumento; eso ya es análisis interprocedural, no barrido de
instrucciones.

Se probó a heredar el tipo del **vecino medible** más próximo (ventana de
`0x400`): 709 de las 722 tienen uno, pero 325 heredarían `f32` y 250 `f64`. Al no
ser concluyente, se descartó. Preferimos 722 «no medibles» a 722 adivinadas.

## Cómo usarlo

- Para traducir una constante: si `agrees` es `yes` o `no`, manda `kind`. Si es
  `unread` o `address`, el **valor** sigue siendo correcto pero el ancho hay que
  fijarlo por el uso (o portarlo como el helper que lo recibe).
- Regenerar: `python NeuronVS_dsp/tools/sweep_constant_types.py` (unos 9 s).
- Comprobar: `python NeuronVS_dsp/tools/verify_dsp.py` incluye los recuentos y
  la coherencia entre `kind` y los contadores de carga.

## Límites

- La resolución diferida cubre `mov`/`lea`/`add`/`sub` con inmediato; **no**
  cubre `[reg+reg*4]` con la base en otro registro ni tablas de punteros.
- «No medible» no significa «desconocido»: el valor está en el PE; lo que falta
  es el ancho.
- Cero conflictos no prueba que una dirección no se use con dos anchos en sitios
  distintos: la cobertura diferida es parcial por diseño.
