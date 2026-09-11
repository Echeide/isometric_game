# Personajes: hojas independientes por acción

Base gráfica original inspirada en las proporciones de la referencia: cabeza grande, pelo asimétrico, contorno oscuro, ropa clara y mochila visible de espaldas. El arte sigue siendo una base editable que puede pulirse manualmente.

Cada personaje (explorer, lucia, marcos) tiene cinco PNG RGBA:

| Acción | Fotogramas por dirección | Hoja | Velocidad |
|---|---:|---|---|
| idle | 4 | 256×384 | 3 fps |
| walk | 8 | 512×384 | 10 fps |
| work | 4 | 256×384 | 8 fps |
| talk | 4 | 256×384 | 5 fps |
| celebrate | 6 | 384×384 | 8 fps |

Las cuatro filas de cada hoja son NE, SE, SW, NW. Celdas 64×96; origen de pies (32,80). Sit reproduce solo la primera columna de work. Las direcciones izquierda/derecha son reflejos del mismo diseño simétrico; frente y espalda tienen dibujos distintos. Para accesorios asimétricos puedes editar cada dirección por separado.

El taller /sprites permite seleccionar personaje, acción y orientación, y descargar cada hoja. La plantilla de 8 columnas sirve como guía: recorta las columnas sobrantes para las acciones más cortas. Elimina las guías antes de exportar.

En catalog.json, cada animación declara image, variants (rutas por color del compañero), row, frames y fps. El motor mantiene el formato anterior: si una animación no declara image, usa el atlas global character.image/variants. La demo carga todas las acciones al entrar; separarlas mejora la edición pero no implica carga bajo demanda.

Regenerar: python3 scripts/build-characters.py. Sobrescribe solo estas hojas y la configuración character del catálogo; no altera mobiliario ni mapas. Guarda copias de tus ediciones manuales antes de ejecutarlo. Los PNG antiguos explorer.png/lucia.png/marcos.png se conservan como respaldo y ya no se usan en la demo.
