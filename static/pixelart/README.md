# Recursos pixel art

La demo conecta este catálogo a World con la prop `graphics`. Sin ella se utiliza el dibujo procedural. El taller `/sprites` permite ver animaciones y descargar PNG; no es un editor de píxeles integrado.

## Editar

- PNG RGBA transparente, sin suavizado al pintar o escalar. Baldosa 64×32, proyección isométrica 2:1.
- Personajes: ahora usan [hojas separadas por acción](characters/README.md), todas con cuatro filas y celdas 64×96. Origen de pies (32,80). Cada animación declara su propio PNG y variantes en `catalog.json`.
- Archivos activos: `characters/{explorer,lucia,marcos}/{idle,walk,work,talk,celebrate}.png`. Sentado reutiliza el primer fotograma de work. Las hojas antiguas de 512×2304 son respaldo y no se cargan.
- La plantilla incluye cuatro direcciones y ocho columnas; recorta las columnas sobrantes y elimina las guías al exportar.
- Escritorio actual: `desk-v2.png`, mostrado a 112×112, con `origin` (37,59), huella 2×1. Se conserva `desk.png` como dibujo original. Árbol: imagen de mayor resolución mostrada a 72×108; origen (36,81) sitúa su tronco en el centro de una casilla. El árbol es arte de referencia y necesita una futura pasada manual para una densidad de píxel idéntica al resto.
- `objects[id].image` acepta un PNG individual. Opcionalmente `frame: [x,y,width,height]` recorta un objeto dentro de una hoja compartida. `width`, `height` y `origin` se expresan en unidades de pantalla antes del zoom.
- El tamaño del dibujo y la huella de colisión son independientes: cambiar Anchura/Profundidad en el editor no estira el sprite. Dibuja un recurso acorde con la huella.
- Guarda los recursos en esta carpeta y actualiza `catalog.json` si cambian sus rutas o medidas. Recarga la página tras editar imágenes: Pixi mantiene las texturas en caché durante la sesión.
- El mapa guarda `visualId`; el catálogo gráfico guarda cómo se dibuja. Exporta el mapa desde el editor para conservar cambios.

El motor usa filtrado nearest y redondeo de posición del avatar. El ajuste automático de cámara admite escalas fraccionarias para encajar el mapa: no garantiza un píxel de pantalla por múltiplo entero en todos los tamaños de ventana. La preferencia de movimiento reducido fija el primer fotograma.

## Procedencia y alcance

Personajes, escritorio y suelo originales generados mediante `scripts/build-pixelart.py`. Ejecutarlo sobrescribe esas hojas y catalog.json; guarda las ilustraciones editadas a mano con otros nombres antes de regenerar. No sobrescribe tree.png.

Árbol creado con imagegen (modo generación, sin imagen de entrada). Prompt: “Create a production game sprite: ONE isometric oak tree for a cozy pixel art office/exploration game, genuinely transparent background (alpha), no ground tile, no text, no extra objects, no border, no shadow outside tree. Aseprite-style crisp pixel art, clearly visible chunky square pixel clusters equivalent to a native 64x96 sprite enlarged with nearest-neighbor. Rounded lush green canopy with 3-4 shade ramps, warm brown short trunk visible and small roots. Isometric 2:1 view, light from upper left. Full tree centered horizontally, trunk base at approximately 90% of image height, comfortable transparent margins on all sides. Avoid painterly rendering, antialiasing, blur, gradients, photorealism. Output portrait canvas. This is an actual transparent sprite to integrate into the current project's asset catalog.”

Todos los tipos del catálogo tienen contrapartida pixel art: escritorio, mesa, sofá, planta, árbol, panel, bandera y personaje. La silla asociada al puesto usa también un PNG y la bandera tiene una variante completada. Paredes, ventanas y base del escenario siguen siendo geometría procedural. Para integrarlo en otro proyecto copia los recursos estáticos y pasa el catálogo a World: el motor no depende de las rutas de esta demo.

## Mobiliario adicional

`python3 scripts/build-pixel-objects.py` regenera únicamente mesa (2×1), sofá (1×3), planta (1×1), panel (3×1), bandera (1×1), bandera completada y silla auxiliar. Sus PNG y anclajes se añaden al catálogo; no sustituye los personajes ni el árbol. Ambos generadores preservan las entradas adicionales del catálogo. Guarda cualquier PNG editado a mano antes de regenerar su grupo. Los nuevos objetos del editor usan las huellas indicadas; importar mapas antiguos no modifica sus tamaños.

## Escritorio revisado

`desk-v2.png` se creó con imagegen en modo edición, usando `desk.png` como referencia: escritorio de roble cálido, soportes metálicos verde salvia, monitor panorámico, teclado, ratón y taza; proyección isométrica 2:1, fondo transparente y píxeles marcados. El generador de recursos conserva esta asignación y no sobrescribe la imagen revisada.

## Asientos y superposición

`python3 scripts/build-chairs.py` genera sillas en cuatro direcciones, además de sus capas de base y respaldo. El motor alinea silla y personaje 0,3 casillas hacia el escritorio sin cambiar la celda de navegación. En orientaciones NE/NW, el respaldo se dibuja delante de la parte inferior del personaje; en SE/SW queda detrás. Los fotogramas sentados apoyan la cadera a 18 píxeles del suelo, junto al asiento de 19 píxeles. Después de regenerar el mobiliario general ejecuta este generador para actualizar las capas direccionales.

## Volteo horizontal en el editor

Selecciona un objeto y pulsa **↔ Voltear horizontalmente**. `flipX` se guarda con el mapa y vuelve al estado original al pulsar otra vez. El dibujo se refleja sobre el eje vertical de su origen isométrico; etiquetas y textos no se reflejan. La huella intercambia ancho/profundidad y los puntos de interacción y el asiento se reflejan con ella. El editor valida límites, colisiones y accesibilidad antes de aplicar. No crea vistas nuevas de la parte trasera ni cambia la iluminación del PNG: es un reflejo del gráfico existente. Usa **Guardar y jugar** para aplicarlo al mundo.

## Pintar el terreno

Selecciona **Mapa** en el listado del editor. La sección **Baldosas del suelo** ofrece los tres suelos del catálogo: oficina, césped y camino. Seleccionar uno activa el pincel; pulsa o arrastra con ratón o dedo para pintar. **Restaurar suelo** recupera el terreno predeterminado de la casilla y **Dejar de pintar** devuelve la interacción normal. Cada trazo es una operación de deshacer. El pincel también puede pintar bajo el mobiliario y no modifica las colisiones.

El JSON guarda las modificaciones en `tiles`, un diccionario de coordenadas `"x,y"` a `"office"`, `"grass"` o `"path"`. Las casillas sin entrada usan el suelo original del tema. **Guardar y jugar** conserva el terreno en este navegador; exportar JSON incluye también estas modificaciones.
