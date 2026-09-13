# Grey player · Primera versión

Creado a partir de la captura proporcionada por el usuario con la herramienta
integrada de generación de imágenes. Los prompts de generación y corrección
están en `prompts.json`; `generated/` conserva los resultados de alta resolución.
`scripts/pack-grey-player.cjs` empaqueta los fotogramas generados en la cuadrícula
del juego y conserva su canal alfa. `packing.json` documenta las medidas.

Todas las hojas finales tienen celdas de **64×96**, cuatro filas en orden
**NE, SE, SW, NW** y apoyo de referencia **(32,80)**.

| Archivo | Frames por dirección | Medidas | FPS sugeridos |
|---|---:|---|---:|
| idle.png | 4 | 256×384 | 3 |
| walk.png | 8 | 512×384 | 10 |
| work.png | 4 | 256×384 | 8 |
| talk.png | 4 | 256×384 | 5 |
| celebrate.png | 6 | 384×384 | 8 |
| sit.png | 1 | 64×384 | 1 |

Abre `preview.html` mediante el servidor local para comparar las acciones y
direcciones. También puedes cargar cada PNG en el taller de sprites.
`character.json` contiene la configuración de este personaje; no se ha aplicado
al catálogo activo. `sit.png` es una pose sentada independiente; `work.png`
muestra manos en posición de trabajo sin incluir mesa ni silla.

Es una primera versión generada, no un ciclo dibujado a mano: algunos pasos y
gestos son similares entre sí, y las transiciones pueden requerir retoques.
Revisar el ciclo animado y la colocación sobre las sillas antes de adoptarlo.
