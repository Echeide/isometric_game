# Biblioteca provisional de aventuras

El editor y el juego usan `AdventureRepository`, definido en `src/lib/storage/local-adventures.ts`. El motor `@isometrico/world` sigue recibiendo un `WorldScene` y un `PixelArtPack`, sin depender de IndexedDB, usuarios, Prisma o la demo.

## Uso

- Editor → Aventuras: crear, renombrar, duplicar y seleccionar aventuras.
- Guardar / Guardar y jugar conserva mapas, salidas y artículos de inventario.
- Más opciones → Recursos de la aventura (también en el panel Aventuras): descargar plantillas PNG y sustituir imágenes con las mismas dimensiones. Los cambios son específicos de esa aventura.
- Exportar ZIP con recursos produce `manifest.json` y `assets/*.png`. Importar ZIP valida y guarda el conjunto de forma atómica; los identificadores de aventura existentes se importan como una copia.
- Los JSON anteriores siguen siendo importables, pero no contienen imágenes personalizadas.

Las hojas mantienen su cuadrícula, anclajes, filas de direcciones y animaciones. Esta primera versión sustituye imágenes de los recursos existentes. Crear nuevos tipos de objetos o configurar nuevos tamaños y clips es un paso posterior.

## Datos y portabilidad

IndexedDB `isometrico-workshop`, versión 1:

- `library/current`: biblioteca de aventuras y selección activa.
- `packs/<adventureId>`: catálogo gráfico específico de una aventura.
- `assets/<uuid>`: PNG binarios, referidos en los catálogos mediante `asset:<uuid>`.

Al abrir por primera vez se migra la biblioteca anterior de localStorage; los valores anteriores no se borran ni sobrescriben. Desde ese momento IndexedDB es la fuente de verdad. La copia no implica sincronización entre dispositivos. Es necesario exportar para trasladar los datos o conservar una copia externa.

La resolución de `asset:` a URL de Blob ocurre en la aplicación; esas URLs temporales no se guardan ni se exportan. Las imágenes incluidas de serie mantienen su ruta `/pixelart/` mientras no se sustituyan. El ZIP incluye el catálogo completo, también los recursos aún no colocados, para continuar editando sin depender de la instalación original.

El progreso del jugador (inventario adquirido, tareas, conversaciones) no forma parte del paquete. Duplicar una aventura crea un ID nuevo y, por tanto, progreso independiente.

La importación limita número de entradas, tamaños descomprimidos, rutas admitidas, dimensiones de PNG y límites de las animaciones. La decodificación de todas las imágenes precede a la escritura. Límite total: 100 MB; por archivo: 10 MB. La gestión de versiones antiguas del paquete requerirá migraciones explícitas cuando cambie el formato.

## Integración con Checkpoint / RoutingTales

Implementar el contrato `AdventureRepository` con la API del anfitrión y cambiar la composición de la demo. Prisma puede almacenar la definición versionada del mapa y los metadatos de los recursos; los PNG pueden vivir en el almacenamiento de archivos del anfitrión. El resolutor traduce los identificadores a las URLs que consume el motor. Los permisos, pertenencia a proyecto y progreso quedan bajo control del anfitrión.

Los recursos compartidos al duplicar son inmutables: sustituir crea un identificador nuevo. Esta primera versión no elimina aventuras ni purga binarios antiguos; la recolección de recursos sin referencias y los escenarios automáticos de carga quedan pendientes. El panel muestra los totales de imágenes, mapas y elementos para orientar las pruebas manuales.
