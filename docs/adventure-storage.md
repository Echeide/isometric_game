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

## Panel de pruebas y reinicio

El botón de portapapeles junto a la mochila abre **Pruebas de aventura**. Permite completar y reabrir objetivos de todos los mapas y las tareas de la demo. Registra hasta 100 acciones: cambios de hitos, tareas, viajes, recogidas y pasos de conversación. No reconstruye actividad anterior a esta versión.

Los hitos, tareas y registro se guardan por aventura en `isometrico.progress.v1:<id>`; inventario y chats mantienen sus claves independientes. El reinicio requiere confirmación en el panel, limpia únicamente el progreso de esa aventura (incluidos chats de mapas eliminados) y vuelve al punto inicial. No modifica definiciones de mapas ni recursos. El registro comienza de nuevo con una entrada de reinicio. Estas funciones son herramientas locales de la demo y no llaman a las APIs de Checkpoint o RoutingTales.

## Biblioteca general de sprites

El taller separa **Esta aventura** (IndexedDB del navegador) de **Biblioteca general** (archivos privados en el servidor). Guarda primero el recurso en la aventura y pulsa **Añadir a biblioteca general**. En otra aventura, busca por tipo/nombre y pulsa **Incorporar a esta aventura**. La incorporación guarda una copia independiente; no activa automáticamente un jugador ni cambia los objetos ya colocados en mapas.

Los paquetes `.sprite.zip` incluyen solo las imágenes necesarias para ese recurso: originales disponibles, recortes, huella, escala, apoyo y todos los clips del jugador o PNJ. Una ficha incluye `resource.json` y `assets/*.png`. Los jugadores siguen las seis acciones y cuatro direcciones admitidas por el motor. Las conversaciones, misiones e interacciones propias de una aventura no forman parte del sprite.

La biblioteca es inmutable en esta versión: volver a enviar el mismo paquete no lo duplica. Publicar un recurso modificado añade una ficha independiente. Cada incorporación genera nuevos identificadores gráficos y de imágenes; el paquete de la aventura conserva `resourceOrigins` con ID y versión de procedencia. No se actualizan copias automáticamente. No hay borrado remoto en esta primera versión.

**Exportar biblioteca ZIP** descarga un archivo con `library.json` y los paquetes de todos los recursos. **Importar ZIP** admite tanto ese archivo como un `.sprite.zip` individual. Se comprueban rutas, tamaño descomprimido, dimensiones, recortes y clips antes de aceptar el contenido. Límite de 256 recursos, 60 MB por recurso y 200 MB por archivo de biblioteca. Si la biblioteca excede el límite de exportación, descarga las fichas individualmente. La importación de biblioteca valida todos los paquetes antes de escribir y es idempotente; ante un fallo de disco puede haber fichas ya guardadas, por lo que se puede repetir sin duplicarlas.

### Almacenamiento y Railway

- Desarrollo: `.sprite-library/`, excluida de Git, o la ruta indicada en `SPRITE_LIBRARY_DIR`.
- Producción: `SPRITE_LIBRARY_DIR` es obligatorio. Sin él, la API responde 503; no utiliza silenciosamente almacenamiento efímero.
- En Railway, montar un volumen persistente (por ejemplo `/data`) y configurar `SPRITE_LIBRARY_DIR=/data/sprite-library`. No cambiar ni sobrescribir otros directorios de datos del servicio. Los volúmenes se montan al arrancar, no durante la compilación: [documentación oficial](https://docs.railway.com/volumes).
- Configurar `BODY_SIZE_LIMIT=200M` para que adapter-node admita los ZIP antes de que actúen los límites de la aplicación; los endpoints de IA mantienen sus límites propios.
- Requiere el acceso privado existente (`CHARACTER_WORKSHOP_USER`, `CHARACTER_WORKSHOP_PASSWORD`, `ORIGIN`). Listado, descarga, miniaturas y escritura comparten su protección. Las escrituras requieren el mismo origen.
- Una instancia de aplicación por biblioteca de archivos. Cada publicación se escribe en un directorio temporal y se publica mediante renombrado; una interrupción no deja una ficha incompleta visible. Para múltiples réplicas, sustituir este repositorio por almacenamiento compartido con coordinación de escrituras.
- La biblioteca local y la de Railway son distintas. Usa el ZIP para trasladar recursos; no se sincronizan automáticamente. Mantén una copia exportada o un backup del volumen.
