# Catálogo de clases · NeuronVS

Generado por [`tools/make_classes_md.py`](tools/make_classes_md.py) a partir de
[`classes.csv`](classes.csv), [`class_edges.csv`](class_edges.csv) y
[`functions.csv`](functions.csv). Los nombres de clase son **propuestos**;
no hay RTTI ni PDB en el binario.

## Resumen

| Clase | vtable | ctor | obj. | padre | vistas | funcs | líneas |
|---|---|---|---|---|---:|---:|---:|
| `C_OleRef` | `0x10049294` | `—` | — | — | 1 | 10 | 189 |
| `C_RefObject` | `0x1004925c` | `C_RefObject_ctor` | — | `C_OleRef` | 1 | 13 | 321 |
| `C_AudioNode` | `0x100492c0` | `C_AudioNode_ctor` | — | — | 1 | 39 | 1125 |
| `C_AudioComponent` | `0x100493c0` | `C_AudioComponent_ctor` | — | `C_AudioNode` | 1 | 64 | 1647 |
| `C_AudioModule` | `0x10049b60` | `C_AudioModule_ctor` | — | `C_AudioComponent` | 1 | 6 | 128 |
| `C_NeuronCore` | `0x1004f550` | `C_NeuronCore_ctor` | 1008 B | `C_AudioModule` | 1 | 20 | 779 |
| `C_UiRect` | `0x10049604` | `C_UiRect_ctor` | — | — | 1 | 45 | 920 |
| `C_UiControl` | `0x100496d8` | `C_UiControl_ctor` | — | `C_UiRect` | 1 | 15 | 398 |
| `C_UiPanel` | `0x100497d4` | `C_UiPanel_ctor` | — | `C_UiControl` | 1 | 10 | 568 |
| `C_UiContainer` | `0x100498e0` | `C_UiContainer_ctor` | — | `C_UiControl` | 1 | 24 | 1099 |
| `C_GraphEditor` | `0x1004dea0` | `C_GraphEditor_ctor` | — | `C_UiPanel` | 3 | 5 | 273 |
| `C_ParameterPage` | `0x1004e030` | `C_ParameterPage_ctor` | 304 B | `C_UiContainer` | 1 | 6 | 357 |
| `C_Editor` | `0x1004f7a0` | `C_Editor_ctor` | 2820 B | `C_RefObject` | 2 | 4 | 361 |
| `C_Rect` | `0x10049a28` | `C_Rect_ctor` | — | — | 1 | 5 | 109 |
| `C_Widget` | `0x10049a20` | `C_Widget_ctor` | — | — | 1 | 2 | 116 |
| `C_OwnerWidget` | `0x10049a24` | `C_OwnerWidget_ctor` | — | — | 1 | 2 | 127 |
| `C_Window` | `0x10049aa8` | `C_Window_ctor` | — | — | 1 | 16 | 657 |
| `C_Bitmap` | `0x10049b40` | `C_Bitmap_ctor` | — | — | 1 | 11 | 453 |
| `C_HitRegion` | `0x1004cfd0` | `C_HitRegion_ctor` | — | — | 1 | 3 | 101 |
| `C_BitmapBox` | `0x1004d188` | `C_BitmapBox_ctor` | — | — | 1 | 5 | 191 |
| `C_Knob` | `0x1004d21c` | `C_Knob_ctor` | — | — | 1 | 5 | 293 |
| `C_Led` | `0x1004e20c` | `C_Led_ctor` | — | — | 1 | 3 | 128 |
| `C_IconButton` | `0x1004e888` | `C_IconButton_ctor` | — | — | 1 | 5 | 422 |
| `C_DisplayButton` | `0x1004e940` | `C_DisplayButton_ctor` | — | — | 2 | 7 | 849 |
| `C_PadGrid` | `0x1004ea8c` | `C_PadGrid_ctor` | — | — | 1 | 5 | 804 |
| `C_ControlPanel` | `0x1004f468` | `C_ControlPanel_ctor` | — | — | 1 | 4 | 679 |
| `C_EditorChild` | `0x1004f7d8` | `C_EditorChild_ctor` | — | — | 1 | 3 | 102 |

## Convención de nombres

| Patrón | Significado |
|---|---|
| `C_<Clase>_ctor` | constructor; instala la vtable primaria |
| `C_<Clase>_dtor` | slot 0: destructor **escalar** (cuerpo del destructor + `operator_delete`) |
| `C_<Clase>_dtorBody` | cuerpo del destructor: reinstala la vtable de la clase; en una base sin ctor es la prueba de que el subobjeto existe |
| `C_<Clase>_v01_<verbo>` | slot 1: el primer método virtual, nombrado por su cuerpo (`paint`, `getRect`, `setParameter`, `AddRef`, `updateStatus`) |
| `C_<Clase>_vNN` | método virtual del slot NN de la vtable primaria |
| `C_<Clase>_vNN_<pista>` | ídem, con pista semántica del cuerpo |
| `C_<Clase>_ifaceXXXX_vNN` | método de la vista secundaria que empieza en `0x...XXXX` |
| `<Componente>_ctor` | inicializador de un componente no virtual del núcleo |
| `VST_main_entry` | export `main` (`0x1001b010`) |

Nombres fuera del patrón: 0 (de 342).

El slot 0 es el destructor escalar en 26 de las 27 clases; el resto de slots son métodos. `C_Bitmap` no declara destructor virtual: su slot 0 es `QueryInterface` y el 1 `AddRef`. El slot 1 no es un destructor en ninguna clase: es su primer método virtual y el export ya lleva el nombre que `slot1_names.py` justifica con el cuerpo de cada entrada. 25 de las 27 familias tienen nombre declarado (`slot1_declared`); `C_Widget`, `C_OwnerWidget` no tienen slot 1 (tabla de un solo slot: `outside-table`).

## Clases

### `C_OleRef`

- **vtable primaria:** `0x10049294` (raíz)
- **constructor:** — (trivial e inlineado en el derivado: no hay función propia)
- **clases derivadas:** `C_RefObject`
- **evidencia:** base of C_RefObject: its 11 slots are the first 11 indices of 0x1004925c (14 slots) and 3/5/6 hold the same function pointers; no ctor installs it, only the base dtor body 0x10002ce0, which the exception-unwind of C_RefObject's ctor calls
- **destructor:** slot 0 `0x10002e80` (escalar), cuerpo `0x10002e80`; raíz, sin base
- **cadena de destructores:** `C_OleRef` (profundidad 0)
- **slot 1 (primer virtual):** `C_OleRef_v01_getRect` — slot 1 is 0x10002d10 and does not touch `this`: it writes 0 through the caller's pointer and returns 0 (cdecl, so the only argument is the out-pointer). It is the base default of the getRect contract that C_RefObject overrides at 0x10002ea0; the same index and signature in both tables is part of the inheritance evidence
- **funciones (10):** `C_OleRef_dtor` (32 B), `C_OleRef_v04` (20 B), `C_OleRef_v01_getRect` (15 B), `C_OleRef_v02` (12 B), `C_OleRef_v06` (8 B), `C_OleRef_dtorBody` (7 B), …

### `C_RefObject`

- **vtable primaria:** `0x1004925c`
- **constructor:** `C_RefObject_ctor` (`FUN_10002b70`)
- **hereda de:** `C_OleRef` — ctor 10002b70 installs its own table and registers unwind handler 0x100479b8, which destroys the C_OleRef base through 0x10002ce0 (installs 0x10049294); dtor body 10002c10 ends by leaving 0x10049294 installed; slots 3/5/6 are inherited unchanged, 0/1/2/4/7/8/9/10 overridden and 11/12/13 new
- **clases derivadas:** `C_Editor`
- **destructor:** slot 0 `0x10002bf0` (escalar), cuerpo `0x10002c10`; la vptr queda en `C_OleRef` (base inlineada)
- **cadena de destructores:** `C_RefObject > C_OleRef` (profundidad 1)
- **slot 1 (primer virtual):** `C_RefObject_v01_getRect` — slot 1 is 0x10002ea0: overrides C_OleRef's default with the editor rect, writing &this->rect (this+0x10) through the caller's pointer and returning 1 (the effEditGetRect contract of the VST2 editor)
- **funciones (13):** `C_RefObject_ctor` (120 B), `C_RefObject_v13` (113 B), `C_RefObject_v10` (52 B), `C_RefObject_v04` (43 B), `C_RefObject_dtor` (30 B), `C_RefObject_v07` (26 B), …

### `C_AudioNode`

- **vtable primaria:** `0x100492c0` (raíz)
- **constructor:** `C_AudioNode_ctor` (`FUN_10002fb0`)
- **clases derivadas:** `C_AudioComponent`
- **evidencia:** base of the audio object chain
- **destructor:** slot 0 `0x10003070` (escalar), cuerpo `0x10003090`; raíz, sin base
- **cadena de destructores:** `C_AudioNode` (profundidad 0)
- **slot 1 (primer virtual):** `C_AudioNode_v01_setParameter` — slot 1 is 0x100033d0, the empty stub the audio chain shares with other no-op slots; C_NeuronCore overrides it at 0x1001ba00, the target of the VST2 setParameter stub 0x10002f50 (index, value)
- **funciones (39):** `C_AudioNode_v44` (488 B), `C_AudioNode_v06` (418 B), `C_AudioNode_ctor` (185 B), `C_AudioNode_v45` (127 B), `C_AudioNode_v41` (94 B), `C_AudioNode_v42` (78 B), …

### `C_AudioComponent`

- **vtable primaria:** `0x100493c0`
- **constructor:** `C_AudioComponent_ctor` (`FUN_10003910`)
- **hereda de:** `C_AudioNode` — ctor 10003910 calls 10002fb0 before installing its vtable
- **clases derivadas:** `C_AudioModule`
- **destructor:** slot 0 `0x10003940` (escalar), cuerpo `0x10003960`; enlaza con `0x10003090` (base `C_AudioNode`)
- **cadena de destructores:** `C_AudioComponent > C_AudioNode` (profundidad 1)
- **slot 1 (primer virtual):** `C_AudioComponent_v01_setParameter` — slot 1 is 0x100033d0, inherited from C_AudioNode: the empty stub shared by the audio chain; the component does not override setParameter
- **funciones (64):** `C_AudioComponent_v06` (1419 B), `C_AudioComponent_v144` (136 B), `C_AudioComponent_v143` (111 B), `C_AudioComponent_v141_createChild` (99 B), `C_AudioComponent_v80` (55 B), `C_AudioComponent_v62` (51 B), …

### `C_AudioModule`

- **vtable primaria:** `0x10049b60`
- **constructor:** `C_AudioModule_ctor` (`FUN_10009f60`)
- **hereda de:** `C_AudioComponent` — ctor 10009f60 calls 10003910 before installing its vtable
- **clases derivadas:** `C_NeuronCore`
- **destructor:** slot 0 `0x10009fb0` (escalar), cuerpo `0x10009fd0`; enlaza con `0x10003960` (base `C_AudioComponent`)
- **cadena de destructores:** `C_AudioModule > C_AudioComponent > C_AudioNode` (profundidad 2)
- **slot 1 (primer virtual):** `C_AudioModule_v01_setParameter` — slot 1 is 0x100033d0, inherited from C_AudioNode: the empty stub shared by the audio chain; the module does not override setParameter
- **funciones (6):** `C_AudioModule_v50` (81 B), `C_AudioModule_ctor` (57 B), `C_AudioModule_v04` (36 B), `C_AudioModule_dtor` (30 B), `C_AudioModule_v145` (4 B), `C_AudioModule_v146` (4 B)

### `C_NeuronCore`

- **vtable primaria:** `0x1004f550`
- **constructor:** `C_NeuronCore_ctor` (`FUN_1001b140`)
- **tamaño de objeto:** 1008 bytes
- **hereda de:** `C_AudioModule` — ctor 1001b140 calls 10009f60; 1008-byte object built by main, owns 6 components + Editor
- **destructor:** slot 0 `0x1001b600` (escalar), cuerpo `0x1001b620`; enlaza con `0x10009fd0` (base `C_AudioModule`)
- **cadena de destructores:** `C_NeuronCore > C_AudioModule > C_AudioComponent > C_AudioNode` (profundidad 3)
- **slot 1 (primer virtual):** `C_NeuronCore_v01_setParameter` — slot 1 is 0x1001ba00: the override that the VST2 setParameter stub 0x10002f50 calls (index, value)
- **funciones (20):** `C_NeuronCore_ctor` (1201 B), `VST_main_entry` (263 B), `C_NeuronCore_v116` (150 B), `C_NeuronCore_v71` (48 B), `C_NeuronCore_v110` (45 B), `C_NeuronCore_v112` (45 B), …

### `C_UiRect`

- **vtable primaria:** `0x10049604` (raíz)
- **constructor:** `C_UiRect_ctor` (`FUN_10004950`)
- **clases derivadas:** `C_UiControl`
- **evidencia:** rectangle-aware base of the UI widgets
- **destructor:** slot 0 `0x10004a10` (escalar), cuerpo `0x10004a30`; destruye un `C_Rect` embebido
- **cadena de destructores:** `C_UiRect` (profundidad 0)
- **slot 1 (primer virtual):** `C_UiRect_v01_paint` — slot 1 holds MSVCRT.DLL::purecall: C_UiRect declares it pure. Its descendants implement it: C_UiControl 0x10004d00, C_UiPanel 0x100055e0, C_UiContainer 0x100066e0 and C_GraphEditor 0x100151c0 draw text/bitmaps on the HDC they receive (FUN_10004de0/FUN_10008ec0); C_ParameterPage 0x10015ed0 takes no HDC and updates the editor status line instead. Slot 2 (0x10004d80) forwards its HDC to slot 1, and C_Window's paint forwards its own context to this slot on every child
- **funciones (45):** `C_UiRect_ctor` (187 B), `C_UiRect_v03` (67 B), `C_UiRect_v19` (49 B), `C_UiRect_v14` (42 B), `C_UiRect_v22` (41 B), `C_UiRect_v50` (40 B), …

### `C_UiControl`

- **vtable primaria:** `0x100496d8`
- **constructor:** `C_UiControl_ctor` (`FUN_10004ba0`)
- **hereda de:** `C_UiRect` — ctor 10004ba0 calls 10004950
- **clases derivadas:** `C_UiPanel`, `C_UiContainer`
- **destructor:** slot 0 `0x10004cb0` (escalar), cuerpo `0x10004cd0`; enlaza con `0x10004a30` (base `C_UiRect`)
- **cadena de destructores:** `C_UiControl > C_UiRect` (profundidad 1)
- **slot 1 (primer virtual):** `C_UiControl_v01_paint` — slot 1 is 0x10004d00: formats the bound value (+0x44) with the registered formatter (+0x68/+0x6c, sprintf fallback) and draws the string with FUN_10004de0(HDC, text, 0)
- **funciones (15):** `C_UiControl_ctor` (258 B), `C_UiControl_v01_paint` (128 B), `C_UiControl_v52` (82 B), `C_UiControl_v53` (82 B), `C_UiControl_v54` (82 B), `C_UiControl_v55` (82 B), …

### `C_UiPanel`

- **vtable primaria:** `0x100497d4`
- **constructor:** `C_UiPanel_ctor` (`FUN_10005410`)
- **hereda de:** `C_UiControl` — ctor 10005410 calls 10004ba0; GDI DeleteObject in methods
- **clases derivadas:** `C_GraphEditor`
- **destructor:** slot 0 `0x100054f0` (escalar), cuerpo `0x10005510`; enlaza con `0x10004cd0` (base `C_UiControl`)
- **cadena de destructores:** `C_UiPanel > C_UiControl > C_UiRect` (profundidad 2)
- **slot 1 (primer virtual):** `C_UiPanel_v01_paint` — slot 1 is 0x100055e0: prints its `%s` label (+0xac) and draws it with FUN_10004de0(param_2, ...), then clears the repaint flag through slot 14
- **funciones (10):** `C_UiPanel_v11_releaseGdi` (549 B), `C_UiPanel_v12` (438 B), `C_UiPanel_v01_paint` (154 B), `C_UiPanel_ctor` (135 B), `C_UiPanel_v63` (115 B), `C_UiPanel_v04` (75 B), …

### `C_UiContainer`

- **vtable primaria:** `0x100498e0`
- **constructor:** `C_UiContainer_ctor` (`FUN_10005b80`)
- **hereda de:** `C_UiControl` — ctor 10005b80 calls 10004ba0; adds child-list methods
- **clases derivadas:** `C_ParameterPage`
- **destructor:** slot 0 `0x10005ca0` (escalar), cuerpo `0x10005cc0`; enlaza con `0x10004cd0` (base `C_UiControl`)
- **cadena de destructores:** `C_UiContainer > C_UiControl > C_UiRect` (profundidad 2)
- **slot 1 (primer virtual):** `C_UiContainer_v01_paint` — slot 1 is 0x100066e0: blits the selected child bitmap (+0xa0[+0xb4] + 0xd0) or a null label into the HDC with FUN_10004de0(param_2, ...)
- **funciones (24):** `C_UiContainer_v12_releaseGdi` (510 B), `C_UiContainer_v63` (328 B), `C_UiContainer_v64` (311 B), `C_UiContainer_v66` (301 B), `C_UiContainer_v65` (270 B), `C_UiContainer_v70` (226 B), …

### `C_GraphEditor`

- **vtable primaria:** `0x1004dea0`
- **constructor:** `C_GraphEditor_ctor` (`FUN_10014dd0`)
- **hereda de:** `C_UiPanel` — ctor 10014dd0 calls 10005410; two secondary purecall views at object offsets 0x1b4/0x1d0
- **vistas secundarias:** `0x1004de9c`, `0x1004dfac`
- **destructor:** slot 0 `0x10015100` (escalar), cuerpo `0x10015120`; enlaza con `0x10005510` (base `C_UiPanel`)
- **cadena de destructores:** `C_GraphEditor > C_UiPanel > C_UiControl > C_UiRect` (profundidad 3)
- **slot 1 (primer virtual):** `C_GraphEditor_v01_paint` — slot 1 is 0x100151c0: blits the editor bitmap with FUN_10008ec0 (BitBlt) or draws its label (+0xac) with FUN_10004de0 on the HDC it receives, and clears the +0x1f1 collapsed flag
- **funciones (5):** `C_GraphEditor_ctor` (808 B), `C_GraphEditor_v04` (198 B), `C_GraphEditor_v01_paint` (177 B), `C_GraphEditor_ifacede9c_v00` (43 B), `C_GraphEditor_dtor` (30 B)

### `C_ParameterPage`

- **vtable primaria:** `0x1004e030`
- **constructor:** `C_ParameterPage_ctor` (`FUN_10015950`)
- **tamaño de objeto:** 304 bytes
- **hereda de:** `C_UiContainer` — ctor 10015950 allocates child components from a page table; 304 bytes
- **destructor:** slot 0 `0x10015ab0` (escalar), cuerpo `0x10015ad0`; enlaza con `0x10005cc0` (base `C_UiContainer`)
- **cadena de destructores:** `C_ParameterPage > C_UiContainer > C_UiControl > C_UiRect` (profundidad 3)
- **slot 1 (primer virtual):** `C_ParameterPage_v01_updateStatus` — slot 1 is 0x10015ed0 and never touches an HDC: it formats the selected parameter (+0x124/+0x128, formatter at slot 0x10c) and publishes the text with FUN_100158d0, which copies it into the editor's status line (+0x1cc) and repaints the editor (0x10015280) when it exists; hence updateStatus, not paint
- **funciones (6):** `C_ParameterPage_ctor` (350 B), `C_ParameterPage_v63` (325 B), `C_ParameterPage_v64` (302 B), `C_ParameterPage_v33` (128 B), `C_ParameterPage_v01_updateStatus` (121 B), `C_ParameterPage_dtor` (30 B)

### `C_Editor`

- **vtable primaria:** `0x1004f7a0`
- **constructor:** `C_Editor_ctor` (`FUN_1001bad0`)
- **tamaño de objeto:** 2820 bytes
- **hereda de:** `C_RefObject` — ctor 1001bad0 calls 10002b70; secondary view at offset 0x24; owns 7 UI children; 2820 bytes
- **vistas secundarias:** `0x1004f79c`
- **destructor:** slot 0 `0x1001bf10` (escalar), cuerpo `0x1001bf30`; enlaza con `0x10002c10` (base `C_RefObject`)
- **cadena de destructores:** `C_Editor > C_RefObject > C_OleRef` (profundidad 2)
- **slot 1 (primer virtual):** `C_Editor_v01_getRect` — slot 1 is 0x10002ea0, inherited from C_RefObject: writes the editor rect (this+0x10) and returns 1
- **funciones (4):** `C_Editor_ctor` (1083 B), `C_Editor_v02_createChild` (557 B), `C_Editor_v03` (61 B), `C_Editor_dtor` (30 B)

### `C_Rect`

- **vtable primaria:** `0x10049a28` (raíz)
- **constructor:** `C_Rect_ctor` (`FUN_10007c80`)
- **evidencia:** ctor 10007c80 stores left/top/right/bottom and flags
- **destructor:** slot 0 `0x10007d00` (escalar), cuerpo `0x10007d20`; raíz, sin base
- **cadena de destructores:** `C_Rect` (profundidad 0)
- **slot 1 (primer virtual):** `C_Rect_v01_paint` — slot 1 is 0x10007d30 and draws nothing: it clears the +0x30 repaint flag through slot 14 (0x10007cf0). It is the family's paint entry: slot 2 (0x10004d80) forwards its HDC to it and slot 5 (0x10007d60) calls it when slot 13 (0x10007ce0) reads the flag set. A bare rect owns no GDI object, so its paint only consumes the repaint request
- **funciones (5):** `C_Rect_ctor` (88 B), `C_Rect_dtor` (30 B), `C_Rect_v14` (10 B), `C_Rect_v01_paint` (10 B), `C_Rect_v13` (4 B)

### `C_Widget`

- **vtable primaria:** `0x10049a20` (raíz)
- **constructor:** `C_Widget_ctor` (`FUN_10006f50`)
- **evidencia:** single-slot view installed by the generic widget ctor 10006f50
- **destructor:** slot 0 `0x100070c0` (escalar), cuerpo `0x100070e0`; raíz, sin base
- **cadena de destructores:** `C_Widget` (profundidad 0)
- **funciones (2):** `C_Widget_ctor` (359 B), `C_Widget_dtor` (30 B)

### `C_OwnerWidget`

- **vtable primaria:** `0x10049a24` (raíz)
- **constructor:** `C_OwnerWidget_ctor` (`FUN_10007940`)
- **evidencia:** single-slot view for a widget that owns an HBITMAP (10007940)
- **destructor:** slot 0 `0x10007ae0` (escalar), cuerpo `0x10007c00`; destruye un `C_Widget` embebido
- **cadena de destructores:** `C_OwnerWidget` (profundidad 0)
- **funciones (2):** `C_OwnerWidget_ctor` (405 B), `C_OwnerWidget_dtor` (30 B)

### `C_Window`

- **vtable primaria:** `0x10049aa8` (raíz)
- **constructor:** `C_Window_ctor` (`FUN_10007e10`)
- **evidencia:** methods call DestroyWindow and window painting APIs
- **destructor:** slot 0 `0x10007f40` (escalar), cuerpo `0x10008060`; destruye un `C_Rect` embebido
- **cadena de destructores:** `C_Window` (profundidad 0)
- **slot 1 (primer virtual):** `C_Window_v01_paint` — slot 1 is 0x10008250: paints the background bitmap (+0x3c) with FUN_10008ec0 and then calls slot 1 (paint) on each child in +0x48 and on the optional view at +0x4c, passing its HDC
- **funciones (16):** `C_Window_ctor` (281 B), `C_Window_v10_releaseGdi` (254 B), `C_Window_v04` (175 B), `C_Window_v09` (152 B), `C_Window_v02` (149 B), `C_Window_v01_paint` (135 B), …

### `C_Bitmap`

- **vtable primaria:** `0x10049b40` (raíz)
- **constructor:** `C_Bitmap_ctor` (`FUN_100099d0`)
- **evidencia:** C_Bitmap_create (10008d60) wraps LoadBitmapA + GetObjectA; ctor 100099d0 adopts an HBITMAP
- **destructor:** slot 0 `0x10009a20` (no virtual), cuerpo `—`; raíz, sin base
- **cadena de destructores:** `C_Bitmap` (profundidad 0)
- **slot 1 (primer virtual):** `C_Bitmap_v01_AddRef` — slot 1 is 0x10009a80: increments the reference count at +4 and returns it; slot 0 is QueryInterface (E_NOINTERFACE) and slot 2 (0x10009a90) is Release, so the table starts QueryInterface/AddRef/Release
- **funciones (11):** `C_Bitmap_v06_createChild` (583 B), `C_Bitmap_v03` (218 B), `C_Bitmap_create` (120 B), `C_Bitmap_dtor` (81 B), `C_Bitmap_v04` (51 B), `C_Bitmap_v02` (38 B), …

### `C_HitRegion`

- **vtable primaria:** `0x1004cfd0` (raíz)
- **constructor:** `C_HitRegion_ctor` (`FUN_10014030`)
- **evidencia:** embeds C_Rect at +8 and clamps bounds from a region table
- **destructor:** slot 0 `0x100140b0` (escalar), cuerpo `0x100140d0`; destruye un `C_Rect` embebido
- **cadena de destructores:** `C_HitRegion` (profundidad 0)
- **slot 1 (primer virtual):** `C_HitRegion_v01_paint` — slot 1 is 0x10007d30, inherited from C_Rect: C_HitRegion does not override paint, so the inherited entry only clears the repaint flag
- **funciones (3):** `C_HitRegion_ctor` (122 B), `C_HitRegion_v04` (65 B), `C_HitRegion_dtor` (30 B)

### `C_BitmapBox`

- **vtable primaria:** `0x1004d188` (raíz)
- **constructor:** `C_BitmapBox_ctor` (`FUN_100141a0`)
- **evidencia:** embeds C_Rect at +8 and loads a bitmap id from DAT_1004d050
- **destructor:** slot 0 `0x100142e0` (escalar), cuerpo `0x10014300`; destruye un `C_Rect` embebido
- **cadena de destructores:** `C_BitmapBox` (profundidad 0)
- **slot 1 (primer virtual):** `C_BitmapBox_v01_paint` — slot 1 is 0x10014380: blits the box bitmap (C_Bitmap at +0x48) over the rect at +8 with FUN_10008ec0 after clearing the repaint flag
- **funciones (5):** `C_BitmapBox_ctor` (306 B), `C_BitmapBox_v01_paint` (121 B), `C_BitmapBox_v04` (89 B), `C_BitmapBox_dtor` (30 B), `C_BitmapBox_v14` (19 B)

### `C_Knob`

- **vtable primaria:** `0x1004d21c` (raíz)
- **constructor:** `C_Knob_ctor` (`FUN_100145b0`)
- **bitmaps:** `11600`, `11601`
- **evidencia:** embeds C_Rect; loads bitmaps 11600/11601 (50x50 filmstrip, 90 frames)
- **destructor:** slot 0 `0x100147c0` (escalar), cuerpo `0x100147e0`; destruye un `C_Rect` embebido
- **cadena de destructores:** `C_Knob` (profundidad 0)
- **slot 1 (primer virtual):** `C_Knob_v01_paint` — slot 1 is 0x10014a70: blits the filmstrip frame (bitmap at +0x8c, FUN_10008f50) over the 50x50 rect; when a parameter is bound (+0x38) it also formats the value into the editor status line (FUN_10015910)
- **funciones (5):** `C_Knob_ctor` (516 B), `C_Knob_v04_createChild` (339 B), `C_Knob_v01_paint` (184 B), `C_Knob_v06` (70 B), `C_Knob_dtor` (30 B)

### `C_Led`

- **vtable primaria:** `0x1004e20c` (raíz)
- **constructor:** `C_Led_ctor` (`FUN_10016000`)
- **bitmaps:** `11300`
- **evidencia:** embeds C_Rect; loads bitmap 11300 (15x7 LED)
- **destructor:** slot 0 `0x100160f0` (escalar), cuerpo `0x10016110`; destruye un `C_Rect` embebido
- **cadena de destructores:** `C_Led` (profundidad 0)
- **slot 1 (primer virtual):** `C_Led_v01_paint` — slot 1 is 0x100161a0: blits bitmap 11300 (15x7) with FUN_10008f50 when lit (+0x58) or FUN_10008ec0 when dark
- **funciones (3):** `C_Led_ctor` (239 B), `C_Led_v01_paint` (162 B), `C_Led_dtor` (30 B)

### `C_IconButton`

- **vtable primaria:** `0x1004e888` (raíz)
- **constructor:** `C_IconButton_ctor` (`FUN_10016a00`)
- **evidencia:** indexes a 0x7c-entry bitmap table DAT_1004e2bc
- **destructor:** slot 0 `0x10016bc0` (escalar), cuerpo `0x10016be0`; destruye un `C_Rect` embebido
- **cadena de destructores:** `C_IconButton` (profundidad 0)
- **slot 1 (primer virtual):** `C_IconButton_v01_paint` — slot 1 is 0x10016d80: blits the icon bitmap (+0x74) with FUN_10008ec0 and then loops the shaded frames of the face selected by +0x64 (0 horizontal, 1 vertical) through FUN_10008ff0
- **funciones (5):** `C_IconButton_v01_paint` (869 B), `C_IconButton_ctor` (438 B), `C_IconButton_v04_createChild` (428 B), `C_IconButton_v06` (70 B), `C_IconButton_dtor` (30 B)

### `C_DisplayButton`

- **vtable primaria:** `0x1004e940` (raíz)
- **constructor:** `C_DisplayButton_ctor` (`FUN_10017470`)
- **vistas secundarias:** `0x1004e9c0`
- **bitmaps:** `11500`, `11501`
- **evidencia:** loads bitmaps 11500/11501 (66x22 display + 7x7 icon)
- **destructor:** slot 0 `0x10017760` (escalar), cuerpo `—`; destruye un `C_Rect` embebido
- **cadena de destructores:** `C_DisplayButton` (profundidad 0)
- **slot 1 (primer virtual):** `C_DisplayButton_v01_paint` — slot 1 is 0x10018220: blits the 66x22 display bitmap 11500 and the 7x7 icon 11501 over its rect with FUN_10008ec0/FUN_10008ff0
- **funciones (7):** `C_DisplayButton_ifacee9c0_v01` (2256 B), `C_DisplayButton_v01_paint` (825 B), `C_DisplayButton_ctor` (741 B), `C_DisplayButton_ifacee9c0_v04` (448 B), `C_DisplayButton_v04` (67 B), `C_DisplayButton_dtor` (30 B), …

### `C_PadGrid`

- **vtable primaria:** `0x1004ea8c` (raíz)
- **constructor:** `C_PadGrid_ctor` (`FUN_10018bb0`)
- **bitmaps:** `11400`, `11401`, `11410`
- **evidencia:** loads bitmaps 11400/11401/11410 (knob frames and 960x240 pad matrix)
- **destructor:** slot 0 `0x10019440` (escalar), cuerpo `0x10019460`; destruye un `C_Rect` embebido
- **cadena de destructores:** `C_PadGrid` (profundidad 0)
- **slot 1 (primer virtual):** `C_PadGrid_v01_paint` — slot 1 is 0x100197f0: blits the 960x240 pad matrix 11410 and the knob frames 11400/11401 into its rect with FUN_10008ec0
- **funciones (5):** `C_PadGrid_ctor` (2181 B), `C_PadGrid_v01_paint` (1165 B), `C_PadGrid_v06` (81 B), `C_PadGrid_v04` (78 B), `C_PadGrid_dtor` (30 B)

### `C_ControlPanel`

- **vtable primaria:** `0x1004f468` (raíz)
- **constructor:** `C_ControlPanel_ctor` (`FUN_10019f20`)
- **evidencia:** ctor creates six child controls via FUN_10007490
- **destructor:** slot 0 `0x1001a9e0` (escalar), cuerpo `0x1001aa00`; destruye un `C_Rect` embebido
- **cadena de destructores:** `C_ControlPanel` (profundidad 0)
- **slot 1 (primer virtual):** `C_ControlPanel_v01_paint` — slot 1 is 0x1001ac30: blits the panel background with FUN_10008ec0 over the rect at +8; the six child controls it owns paint themselves through their own slot 1
- **funciones (4):** `C_ControlPanel_ctor` (2525 B), `C_ControlPanel_v04_createChild` (449 B), `C_ControlPanel_v01_paint` (159 B), `C_ControlPanel_dtor` (30 B)

### `C_EditorChild`

- **vtable primaria:** `0x1004f7d8` (raíz)
- **constructor:** `C_EditorChild_ctor` (`FUN_1001d200`)
- **evidencia:** child view built on C_Rect at +8; ctor 1001d200
- **destructor:** slot 0 `0x1001d220` (escalar), cuerpo `0x1001d240`; destruye un `C_Rect` embebido
- **cadena de destructores:** `C_EditorChild` (profundidad 0)
- **slot 1 (primer virtual):** `C_EditorChild_v01_paint` — slot 1 is 0x10007d30, inherited from C_Rect: C_EditorChild does not override paint, so the inherited entry only clears the repaint flag
- **funciones (3):** `C_EditorChild_v06` (263 B), `C_EditorChild_dtor` (30 B), `C_EditorChild_ctor` (29 B)

## Componentes no virtuales de `C_NeuronCore`

| Componente | Rol | ctor | bytes |
|---|---|---|---|
| `AudioMaster` | host callback | — | — |
| `Remote` | remote/MIDI control | `0x10016790` | 4 |
| `SoundData` | C_Param table (snddat) | `0x10013de0` | 12 |
| `Engine` | DSP engine | `0x10038220` | 4 |
| `Params` | parameter tree | `0x1000be10` | 11484 |
| `Noise` | noise generator | `0x1000b500` | 196 |

El editor (`C_Editor`) es a la vez clase y componente del núcleo: el ctor de
`C_NeuronCore` lo construye en `Core+0x3ec` con 2820 bytes.
