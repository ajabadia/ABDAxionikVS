# El callback `0x10013620`: cómo cambia un modelo

Este es el callback que `params` instala en su primer observador
(`param_1[0xa5] = &LAB_10013620`, que es `observer+0x14`, la pasada 1). Ghidra no lo
había creado como función porque sólo se referencia por dirección; está recuperado
con `DecompileAt.java` y guardado en
[`../NeuronVS_decompiled/functions/10013620_callback_10013620.c`](../NeuronVS_decompiled/functions/10013620_callback_10013620.c).

No es el callback de un parámetro cualquiera: es el de **`R1ModellIndex`** (y, por el
mismo puntero, `R2ModellIndex`). Cuando cambia el número de modelo de un resynator,
reescribe seis registros de parámetros y reconstruye el estado del motor.

## Firma y argumentos

`FUN_10001550` lo invoca así:

```c
(**(code **)(observer + 0x14))(&value_pair, record, observer + 8);
```

- `arg1` — `float[2]` con `{valor_anterior, valor_nuevo}` ya reescalados.
- `arg2` — el registro de 40 B que cambió.
- `arg3` — `observer+8`; su primer dword es el puntero al dueño, `params`.

Eso encaja con el arranque del callback:

```c
iVar3  = *param_3;                    // params
iVar16 = **(int **)(iVar3 + 0x278);   // snddat->tabla (base de los 445 registros)
FUN_100014c0(0);                      // record->clamp(); valor en st0
iVar4  = ftol();                      // índice de modelo = (int)valor
FUN_10046b70();                       // motor: método previo
FUN_1000a7c0();                       // = &DAT_10055738, la banca de modelos
```

`FUN_100014c0` recorta `record+0x1c` y devuelve el valor; el `ftol` lo convierte en el
índice de slot de modelo (0…511 en teoría, 0…127 en la banca).

## Paso a paso

1. **¿R1 o R2?** Compara `record->name` (`record+0x00`) con la cadena de
   `0x100525e0`, que es **`"R1ModellIndex"`**. Si coincide, `isR2 = 0`; si no,
   `isR2 = 1`. El mismo callback sirve para los dos parámetros.
2. **Adquiere el modelo.** `FUN_1000a7d0(banca, índice)` incrementa el contador del
   modelo (`+0x340`) y, en la primera adquisición, comprueba que esté cargado
   (`FUN_1000a930`); si no, devuelve 0 y el callback salta el bloque grande.
3. **Fija el valor pedido.** `FUN_1000a810((int)arg1[0])` sobre la banca.
4. **Si hay modelo**, escribe en el registro que cambió:
   `record+0x04 = 0x10055f38 + índice*0x20` — el nombre del modelo en la caché de
   **512 entradas × 32 B** que el constructor del core rellena con `"--<empty>--"`.
5. **Elige las tablas de índices.** Dos arrays de seis enteros, uno para `Scape` y
   otro para `Sphere`, del resynator que toque:

| Array | Índices | Parámetros |
|---|---|---|
| `scape` R1 | 52, 53, 72, 73, 92, 93 | `R1L1..L3Scape1/2Value` |
| `sphere` R1 | 42, 43, 62, 63, 82, 83 | `R1L1..L3Sphere1/2Value` |
| `scape` R2 | 132, 133, 152, 153, 172, 173 | `R2L1..L3Scape1/2Value` |
| `sphere` R2 | 122, 123, 142, 143, 162, 163 | `R2L1..L3Sphere1/2Value` |

Son exactamente los 24 parámetros que el host expone (más el filtro, que no toca
este callback). Y el bucle no recorre 0…5 sino los desplazamientos `{0,1,4,5,8,9}`
dentro de las tablas del modelo.

6. **Reescribe seis registros `Scape`** (`tabla + scape[i]*0x28`):

```c
record->default      = model->values[0x204/4 + off];   // +0x14
record->name_model   = model + off*9 + 0x234;          // +0x04
record->name_variant = model + off*9 + 0x246;          // +0x08
if (strcmp(+0x04, +0x08) == 0) record->name_variant = "";  // 0x10055140
```

7. **Y otros seis `Sphere`**, igual pero con `+0x2A0` y las cadenas `+0x2D0` /
   `+0x2E2`.

8. **Registra las 128 entradas del modelo en el motor**, una por una:

```c
for (i = 0; i < 0x80; i++)
    FUN_100440d0(isR2, i, e->f8, e->f14, e->f1c, e->f18, e->f20, e->f24, e->f28);
```

Cada modelo es, por tanto, un array de **128 punteros** a subestructuras; el
destructor del modelo (`FUN_1000a8c0`) pone a cero justo esos 128 dwords cuando el
contador de uso llega a 0. Qué escribe exactamente cada llamada —40 B por tecla,
campo a campo, y quién los lee— está en
[`../NeuronVS_dsp/ZONES.md`](../NeuronVS_dsp/ZONES.md): los argumentos son
`slot, key, root, scapeLo, scapeHi, sphereLo, sphereHi, detune, volume`, y el
consumidor es `FUN_10032970`, no el traductor.

9. **Invalida y retraduce.** `FUN_1003d780` pone a 0 el byte `engine+0xD99`, y
   después:

```c
FUN_10040550(0, params + 0x278C);   // el traductor de STATE_SPLIT.md
```

Es decir: cambiar un modelo no es «asignar un parámetro»; es reescribir seis
registros, re-registrar 128 entradas de motor y volver a derivar **todo** el estado
de sonido. Por eso el traductor se llama aquí aunque el valor que cambió sea uno solo.

## Lo que esto corrige de la documentación anterior

`PARAM_RECORD.md` decía que `record+0x04` y `+0x08` estaban **muertos**. No lo están:
lo que está muerto es el valor que traen del `.rdata` (la cadena vacía en los 445
descriptores). En ejecución, este callback los convierte en punteros a dos nombres del
modelo. Y `record+0x14` no es sólo el default que lee el parser: también lo reescribe
este callback con el valor del modelo.

## Límites

- No está probado que `+0x04` y `+0x08` sean «nombre» y «variante»: son dos punteros a
  cadenas de 9 bytes por capa dentro del modelo, y el segundo se vacía cuando coincide
  con el primero. Los nombres son una lectura razonable, no un hecho.
- El contador de la banca (`+0x340`) y la lista de `+0x33C` no se han recorrido
  completos: sólo se sabe que `FUN_1000a7d0` lo incrementa y `FUN_1000a8c0` lo
  decrementa y limpia.

## Verificación

`NeuronVS_preset_format/tools/verify_preset.py` comprueba contra el binario:

- que el primer observador de `params` apunta a `0x10013620` (`param_1[0xa5]`);
- que el callback escribe en `record+4` (`89 79 04` en `0x100136FE`) y lee la banca
  `0x10055738`;
- que compara con `"R1ModellIndex"` en `0x100525E0`;
- que termina llamando a `0x10040550` con `params+0x278C`.
