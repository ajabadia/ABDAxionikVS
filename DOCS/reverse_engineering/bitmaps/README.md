# NeuronVS.dll — bitmaps de la interfaz

Extracción de los recursos gráficos del PE `NeuronVS.dll` (Hartmann Music, 2004) y conversión a PNG. El binario contiene **43 recursos**: **42 `RT_BITMAP`** y **1 `RT_VERSION`**. La galería documenta las 42 imágenes y el recurso de versión por separado.

## Resultado

| Elemento | Cantidad |
|---|---:|
| Recursos `RT_BITMAP` | 42 |
| PNG generados | 42 |
| BMP reconstruidos | 42 |
| Miniaturas | 42 |
| Recursos totales documentados | 43 (42 imágenes + versión) |
| Formato de los bitmaps | 24 bpp, `BI_RGB`, cabecera `BITMAPINFOHEADER` de 40 bytes |
| SHA-256 del DLL | `b27dbe76fb8cbe37ab9236e30d14198f9061bc35b119264b25909969825f7800` |

## Contenido

- [`gallery.html`](gallery.html) — galería visual con tarjetas, metadatos y enlace a cada PNG.
- [`GALERIA.md`](GALERIA.md) — la misma galería en Markdown, con inventario y miniaturas.
- [`contactsheet.png`](contactsheet.png) — hoja de contactos etiquetada con las 42 imágenes.
- `png/` — PNG a tamaño completo, un archivo por ID de recurso.
- `bmp/` — BMP reconstruidos (cabecera `BITMAPFILEHEADER` + DIB original).
- `thumbs/` — miniaturas usadas por la galería.
- [`bitmaps.csv`](bitmaps.csv) / [`bitmaps.json`](bitmaps.json) — metadatos por imagen: ID, RVA, offset, bytes, dimensiones, bpp, compresión, SHA-256, archivos.
- [`resources.csv`](resources.csv) — inventario completo de los 43 recursos del PE.
- [`version_info.txt`](version_info.txt) — contenido del recurso `RT_VERSION` (el recurso 43, no es imagen).

## Qué muestra cada grupo

| IDs | Contenido |
|---|---|
| `10000`–`10003` | Vistas principales del editor (800x652): dos mandos, mando central, mando naranja y pantalla de créditos. |
| `10100`–`10241` | 16 miniaturas de páginas de parámetros (240x138): EQ, compresor, oscilador, LFO, sample & hold, filtro/comb, delays, chorus/flanger, stereo phase. |
| `10300`–`10302` | Tiras de 4 botones/pestañas en verde, azul y rojo (203x46). |
| `11000`–`11004` | Indicadores, displays y un botón desplegable (51x12 a 180x23). |
| `11100`–`11101` | Barras horizontales largas (1568x16 y 1568x10). |
| `11200`–`11203` | Medidor vertical, pista de slider, control anterior/siguiente y thumb. |
| `11300` | LED/brillo de 15x7. |
| `11400`–`11401` | Dos mandos de 128x128 por imagen (marcos azul/rosa y aros verdes). |
| `11410` | Matriz de pads/teclas de 960x240. |
| `11500`–`11501` | Display/botón de 66x22 e icono de 7x7. |
| `11600`–`11601` | Knob de 50x50 y filmstrip vertical de 90 fotogramas de 50x50 (50x4500). |

Las descripciones se basan en el texto visible en cada imagen (por ejemplo `Low Shelf`, `Threshold`, `Stereo Phase`, `Select Wave`) y en la geometría del recurso.

## Método

1. Parseo del árbol de recursos PE (directorio `IMAGE_RESOURCE_DIRECTORY`, niveles tipo/nombre/idioma) y localización de cada payload por RVA.
2. Lectura de la cabecera DIB de cada `RT_BITMAP` (`biSize`, ancho, alto, bpp, compresión, `biClrUsed`).
3. Reconstrucción del BMP: se antepone `BITMAPFILEHEADER` de 14 bytes al DIB original, calculando `bfOffBits` a partir de la cabecera y la paleta. Los 42 recursos son 24 bpp sin paleta, por lo que `bfOffBits = 54`.
4. Apertura con Pillow, verificación de que las dimensiones coinciden con la cabecera y guardado como PNG.
5. Generación de miniaturas, hoja de contactos, CSV/JSON, Markdown y HTML.
6. Verificación: 42 PNG abiertos correctamente, 42 dimensiones coincidentes, 0 errores.

## Verificación realizada

- 42/42 PNG existen y se abren con Pillow.
- Las dimensiones de cada PNG coinciden con `biWidth` x `|biHeight|`.
- 42/42 filas de `bitmaps.csv` apuntan a archivos existentes.
- 43/43 recursos del PE están en `resources.csv`.
- El recurso `RT_VERSION` se decodifica aparte; no se intenta convertir a imagen.

## Limitaciones

- Son recursos de interfaz (piel del editor), no capturas de pantalla en vivo: no incluyen el estado de la aplicación.
- La descripción semántica es inferida a partir del texto visible; los IDs no vienen documentados en el binario.
- El filmstrip `11601` se documenta como 90 fotogramas de 50x50 por su geometría; la animación concreta que lo consume no se ha verificado en ejecución.
- Los BMP reconstruidos conservan el DIB original; no se modifican píxeles ni canales alfa (no hay alfa en estos 24 bpp).

## Reproducir

```bash
python _tools/extract_bitmaps.py
```

El script está en [`../_tools/extract_bitmaps.py`](../_tools/extract_bitmaps.py) y escribe esta carpeta completa.
