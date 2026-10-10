# Generador de personajes

Módulo independiente para convertir vídeos, secuencias de imágenes y filas de hojas PNG en animaciones de personaje. Incluye un componente Svelte 5, un núcleo de procesamiento TypeScript y utilidades de importación/exportación para navegador. El núcleo no depende de `@isometrico/world`, SvelteKit, Pixi ni un proveedor de IA. La interfaz puede recibir adaptadores opcionales de generación de imágenes y vídeo.

La aplicación de este repositorio lo monta en **`/characters`**, accesible desde **Sprites → Generador de personajes**. **Cargar ejemplo del juego** abre las seis acciones del personaje Grey existente para probar el flujo completo. Es material de demostración, no una generación nueva.

## Interfaz del taller

La ruta `/characters` utiliza `studio`: mantiene los cinco pasos en la cabecera, la referencia o animación en el centro, los ajustes a la derecha y la copia ZIP en el pie. **Propiedades** oculta o abre el panel; en pantallas estrechas se convierte en un diálogo con cierre y acciones propias. **Progreso** abre la matriz de acciones y direcciones. Seleccionar una celda lleva a importación o revisión y cierra la matriz. Las dimensiones, estilo y paleta siguen en el paso **Personaje**.

El componente conserva el diseño anterior si se monta sin `studio`. El núcleo y los adaptadores IA no cambian; los paneles se comparten mediante `@isometrico/editor-ui`, sin dependencia del motor de mundo.

## Flujo de trabajo

1. En **Tipo de juego**, elige **Isométrico · nuestro juego** o **Plataformas 2D · vista lateral** y sube una foto o imagen de referencia, o escribe una descripción; define el estilo y los accesorios. Da un identificador sin espacios al personaje.
2. En **Prompts**, crea una primera vista SE para isométrico o E (derecha) para plataformas en la herramienta de imágenes que prefieras. Aprueba su identidad y usa esa imagen como referencia para NE y las demás vistas necesarias. Genera una imagen por orientación para evitar cortes entre figuras de una misma imagen.
3. Usa la vista aprobada como entrada de la herramienta de vídeo. Los prompts describen una cámara fija, movimiento en el sitio, fondo uniforme y acciones por orientación. En acciones en bucle, si el proveedor lo permite, fija la misma imagen al inicio y al final del clip. En acciones de una vez, conserva la última pose sin regresar al inicio. Para `sit` basta una imagen sentada.
4. Selecciona acción y orientación e importa el material. Para PNG secuenciales, los nombres se ordenan numéricamente (`frame2` antes de `frame10`). Para una hoja, indica columnas, filas totales y la fila desde 1. En vídeo, indica inicio, duración y frecuencia de muestreo.
5. Ajusta transparencia, altura, paleta y apoyo. Previsualiza la acción y revisa cada orientación. Puedes seleccionar un intervalo manual, una velocidad de salida y correcciones de escala y posición por vista.
6. En proyectos nuevos, la primera vista procesada fija una paleta que comparten las revisiones y la exportación. Puedes editarla o recalcularla en **Personaje → Formato y dimensiones → Paleta y reducción**. **Construir todas las hojas** conserva esa paleta. **Descargar personaje ZIP** prepara el archivo y muestra un enlace para guardarlo; inspecciona los avisos antes de usar las hojas. **Guardar proyecto** prepara un segundo ZIP con las imágenes fuente y permite volver a abrir el trabajo.

Sin adaptador de imágenes, el módulo prepara los prompts y procesa material importado. Con el adaptador opcional puede generar referencias del personaje; solo se conservan cuando el usuario las aprueba. Repetir una imagen no crea una animación; el procesador avisa cuando necesita repetir muestras.

## Perfiles

| Perfil | Filas, en orden | Acciones | Salida |
|---|---|---|---|
| Nuestro juego | NE, SE, SW, NW | idle (4), walk (8), work (4), talk (4), celebrate (6), sit (1) | Compatible con `CharacterPack` |
| Isométrico · 8 direcciones | SE, SW, NE, NW, E, W, S, N | idle, walk, run, attack; 8 muestras cada una | PNG + JSON genérico |
| Plataformas 2D | E (derecha), W (izquierda) | idle (4), walk (8), run (8), jump (4), fall (2), attack (6), hurt (3), die (6) | PNG + JSON genérico |

Los valores entre paréntesis son los fotogramas iniciales por fila. Cada acción permite 1–16 fotogramas, 1–30 FPS y reproducción en bucle o una vez desde su bloque «Ajustar». En plataformas, jump/fall/attack/hurt/die se reproducen una vez por defecto. Cambiar el tipo de juego queda bloqueado cuando ya hay vistas o fuentes para no reinterpretar el material con otra cámara; guarda el proyecto y crea otro personaje. Por defecto, celdas de 64 × 96 y apoyo en (32, 80). El perfil de ocho direcciones **no se puede conectar directamente al motor actual**: también habría que ampliar orientación, navegación y poses de ese motor.

Con reflejos activos basta E en plataformas y hacen falta NE y SE en el perfil del juego. En el de ocho direcciones hacen falta SE, NE, E, S y N. Las vistas importadas prevalecen sobre los reflejos. Desactívalos o importa vistas propias para accesorios asimétricos. La reflexión no puede convertir una vista frontal en una trasera.

## Qué hace el procesador

- Respeta el alfa existente y elimina el color de fondo elegido por distancia RGB. La interfaz ofrece magenta, verde o transparencia; la API admite cualquier RGB. No segmenta fondos complejos. Un detalle del personaje del mismo color que el fondo también desaparecerá.
- Busca ciclos de aproximadamente 0,35 a 1,8 segundos comparando firmas visuales normalizadas. Favorece extremos similares con movimiento intermedio. Es una heurística visual: no comprueba anatomía, pasos, identidad ni dirección. Los ciclos más largos pueden necesitar intervalo manual. Las acciones «Una vez» conservan todo el intervalo (o el recorte manual) e incluyen su última muestra; nunca buscan un cierre repetitivo.
- En bucles, muestrea el intervalo sin incluir el extremo repetido. En acciones de una vez, incluye ambos extremos cuando hay al menos dos fotogramas. En recorte manual, primera y última muestra son inclusivas en la interfaz; la API usa `[start, end)` con índices desde cero.
- Igualará la altura mediana de cada ciclo a la altura solicitada, con escala constante dentro del clip. Para poses sentadas y gestos usa la altura de `idle` de la misma dirección cuando existe y comparte resolución. Esta referencia presupone el mismo encuadre de origen. El multiplicador por vista corrige diferencias perceptivas y referencias mal encuadradas.
- Estima el apoyo con el centro y borde inferior de la silueta. Por defecto usa un apoyo fijo para todo el ciclo y conserva el movimiento. La estabilización por fotograma elimina deriva, pero también saltos. Se omite para jump/fall/die: usan un apoyo fijo y la escala de idle si comparte encuadre, o la primera muestra en su ausencia. Los ajustes X/Y permiten corregir accesorios que desplacen el centro de la silueta.
- Conserva originales comprimidos y muestras de análisis de hasta 192 px. En navegador, decodifica solo los fotogramas elegidos, elimina el fondo y reduce directamente desde el original a la celda configurada. Usa promedio de área y alfa premultiplicado (IA/vídeo) o píxel más cercano (pixel art existente), alfa binario, una paleta de hasta 64 colores y contorno interior opcional. No añade píxeles fuera de la silueta para el contorno.
- Refleja alrededor del apoyo, empaqueta una hoja por acción y calcula FPS por orientación según la duración del intervalo. En plataformas usa los FPS de la receta; los FPS personalizados por acción tienen prioridad sobre el cálculo automático y los de cada vista sobre los de la acción. El rango de reproducción es 1–30 fps; los límites y repeticiones quedan registrados como avisos.

El ancho, alto, altura objetivo y apoyo del paso 1 definen la escala final. La resolución del original no cambia esa escala. El zoom 1×/2×/3× (2× por defecto) solo amplía la revisión; no cambia los PNG ni el tamaño de edición en Piskel. Con retoques se bloquean tamaño y apoyo hasta restaurar las fuentes.

La paleta fija se obtiene de la primera vista procesada: conviene elegir una que muestre todos los colores. Su primer color se usa para el contorno cuando está activo. Cambiar la paleta invalida las aprobaciones; los píxeles retocados en Piskel conservan sus colores exactos aunque estén fuera de ella. Los proyectos anteriores sin `paletteMode` mantienen la paleta automática por construcción, y pueden optar por fijarla desde el paso 1.

## Archivos

El **ZIP del personaje** contiene:

- `idle.png`, `walk.png`, etc.: RGBA, columnas de tiempo y filas de orientación.
- En formato **Nuestro juego**, `character.json`: rutas públicas, celdas, apoyo, filas, fotogramas y velocidades. Solo admite el perfil del juego y acciones en bucle.
- En formato **Genérico**, `sprites.json`: versión 1 del formato neutral `character-sprites`, PNG relativos al JSON, proyección, celdas, apoyo en píxeles, orientaciones y rectángulos de cada fotograma por vista. Cada acción declara `playback` y `loop`; `loop: false` indica ejecutar una vez y mantener la última pose. Las coordenadas parten de la esquina superior izquierda. Este archivo necesita un adaptador para cada motor; no se presenta como un formato nativo de Unity o Godot.
- `processing.json`: configuración, paleta, índices elegidos, puntuación del cierre, escala, procedencia, reflejos, velocidades y avisos. Las puntuaciones automáticas son relativas al movimiento; las manuales son diferencias absolutas, no son directamente comparables.
- `prompts.json`: descripción del personaje y recetas de generación.
- `LEEME.txt`: carpeta destino y compatibilidad del perfil.

El **ZIP del proyecto** contiene `project.json`, muestras PNG, retoques y originales comprimidos en `originals/` (hasta 150 MB de originales por proyecto; ZIP de hasta 250 MB). Conserva paleta, reducción y escala. Los ZIP anteriores siguen abriéndose con sus muestras; para recuperar detalle perdido necesitan reimportar el original. Cambiar el intervalo de vídeo más allá del tramo muestreado también requiere reimportarlo. Los originales se guardan en el borrador local de IndexedDB y no se suben a ningún servidor.

El procesamiento de hojas sucede localmente. Al pulsar **Generar** con la ayuda de OpenAI se envían la descripción y, si existe, una referencia aprobada al proveedor. Se conserva un borrador local automáticamente; no se escribe al catálogo activo. Conserva el proyecto antes de recargar, abrir otro proyecto o cargar el ejemplo.

## Integrar en el juego

1. Usa el perfil **Nuestro juego** y conserva las seis acciones.
2. Descomprime los PNG en `static/pixelart/characters/<id>/`. La carpeta debe coincidir con **Carpeta pública de los PNG**.
3. Sustituye `graphics.character` por el contenido de `character.json` en el catálogo del anfitrión. El resto del catálogo (objetos y suelo) se conserva.
4. Recarga el mundo y revisa caminar, conversación, celebración y poses sentadas sobre una silla.

```ts
import type { PixelArtPack } from '@isometrico/world';
import catalog from './catalog.json';
import character from './character.json';

const graphics = { ...catalog, character } as PixelArtPack;
```

El motor conserva `fps` para los catálogos antiguos y acepta `directionFps` por orientación. La exportación del generador no incluye variantes de compañeros: el anfitrión debe incorporarlas si quiere varios personajes.

## Reutilizar el módulo

Desde la raíz del repositorio:

```sh
npm run package:characters
npm pack --workspace @isometrico/character-generator
```

Instala el `.tgz` en otro proyecto Svelte 5:

```svelte
<script lang="ts">
  import { CharacterGenerator } from '@isometrico/character-generator';
</script>

<CharacterGenerator />
```

El ejemplo del juego se inyecta mediante `onexample?: () => Promise<Sources>`; el paquete no descarga recursos propios ni contiene rutas del juego.

API sin interfaz, para aplicaciones con bundler:

```ts
import { defaultSettings } from '@isometrico/character-generator/core';
import { readVideo, buildFromOriginals, exportCharacter } from '@isometrico/character-generator/browser';

// `file`, `sources` y `brief` pertenecen al anfitrión.
const clip = await readVideo(file, { start: 0, seconds: 5, fps: 12 });
sources.walk = { ...sources.walk, se: clip };
// Requiere todas las fuentes del perfil; ['walk'] crea solo una vista previa.
const settings = defaultSettings();
const built = await buildFromOriginals(settings, sources);
// Persistir la paleta de la primera construcción para las siguientes.
settings.palette = built.metadata.processingPalette;
const zipBytes = await exportCharacter(built, brief);
```

El núcleo acepta arrays RGBA y no usa DOM. Las utilidades `/browser` requieren canvas, `createImageBitmap`, `HTMLVideoElement`, Blob y URL. No hace falta FFmpeg para los usuarios del taller.

## Límites y revisión

- Hasta 180 muestras por clip y 64 millones de píxeles fuente por proyecto. Las muestras de análisis tienen un lado máximo de 192 px; los originales se conservan comprimidos y solo se decodifican los fotogramas elegidos. La API síncrona del núcleo admite muestras de hasta 512 px por lado.
- Imágenes de hasta 20 MB / 32 MP; vídeos hasta 100 MB y segmentos de hasta 10 segundos. La compatibilidad de códecs depende del navegador; MP4 H.264 y WebM son las opciones habituales.
- El vídeo se muestrea mediante búsqueda temporal del navegador. Los índices exportados corresponden a estas muestras, no a índices originales del archivo. No garantiza extracción exacta de fotogramas en vídeo con frecuencia variable.
- Los clips deben mantener encuadre y resolución. Revisa cortes, halos del chroma, cambios de vestuario, dirección, anatomía, accesorios y continuidad. Los avisos no bloquean exportar: puede ser necesario retocar o regenerar la fuente.
- El procesamiento se ejecuta en el hilo principal; proyectos grandes pueden pausar brevemente la interfaz. El procesamiento no usa workers ni segmentación por IA. La ayuda opcional de OpenAI utiliza un endpoint de servidor; no hay conexión a Scenario.

El diseño del flujo toma como referencia [Iso Cycles: making-of de Scenario](https://www.scenario.com/explorations/iso-cycles/presentation/iso-cycles-making-of.pdf). Los algoritmos de este paquete son una implementación propia; no son los scripts originales de la presentación.

## Verificación

`npm test` cubre el contrato del juego, los ocho rumbos, reflejos y prioridades, transparencia, ciclos, normalización, paleta, límites y velocidades. `npm run check`, `npm run build` y `npm run package:characters` verifican la aplicación y el paquete. El botón de ejemplo permite verificar visualmente importación de hojas y exportación sin un proveedor de IA.


## Crear desde cero con la API de OpenAI

En `/characters`, **Nuevo personaje** limpia el taller para empezar otro diseño. Guarda antes el trabajo anterior. Escribe descripción, estilo visual (libre o uno de los tres presets) y accesorios. No necesitas un archivo de proyecto para comenzar.

La ayuda opcional permite:

1. **Vista de referencia**: genera una propuesta para la orientación seleccionada. Sin referencia previa usa el texto; con una aprobada reutiliza su aspecto.
2. **Aprobar como referencia**: conserva esa vista para peticiones posteriores. Las referencias aprobadas se guardan en el `.project.zip`, incluso si aún no hay animaciones. Los proyectos anteriores siguen siendo compatibles. Una propuesta sin aprobar no se guarda: puedes descargar su PNG original.
3. **Acciones de 1–4 fotogramas**: genera la imagen con ChatGPT y revísala directamente, sin crear un vídeo. Para las acciones más largas, **Descargar PNG**: guarda la referencia aprobada de la orientación que quieras animar y úsala en Kling u otra herramienta de vídeo.
4. **Importar vídeo de Kling u otra herramienta**: carga el clip, revisa un ciclo completo y retoca sus fotogramas en Piskel antes de exportar la hoja final. La importación de secuencias e imágenes existentes sigue disponible.

Comprueba la orientación antes de aprobar: SE muestra cara y pecho en tres cuartos hacia abajo/derecha; NE muestra nuca y espalda hacia arriba/derecha. Si una referencia NE antigua es frontal, quítala y genera una nueva vista NE antes de animarla.

La API de imágenes crea referencias y acciones de 1–4 fotogramas. Para estas acciones puedes elegir **ChatGPT · imágenes** o **Kling · vídeo**: usa una referencia aprobada, revisa la propuesta y pulsa **Usar imagen y revisar ciclo** (o reemplazar si ya existe una fuente). Incluye `sit`, `hurt`, `idle`, `work` y `talk` en el perfil del juego. Las acciones de más de 4 fotogramas usan vídeo. Cambiar de opción conserva la propuesta de imagen y el seguimiento del vídeo; cada proveedor recibe un prompt adaptado a su formato. La imagen aceptada se convierte en una fuente normal, se puede retocar en Piskel y se conserva en el ZIP del proyecto. Las propuestas descartadas no sustituyen la fuente anterior. Las hojas, fuentes, retoques y referencias guardadas en proyectos anteriores siguen cargándose; no se modifica el formato del proyecto. El taller conserva la reproducción a media velocidad y el ajuste manual del intervalo y los FPS para revisar el vídeo importado.

### Activación local

En la raíz del proyecto, copia `.env.example` a `.env`, añade tu clave en `OPENAI_API_KEY` y reinicia `npm run dev`. Pulsa **Comprobar conexión** en el taller. La comprobación solo detecta configuración del servidor; la validez de la clave y el acceso al modelo se conocen al generar.

`OPENAI_IMAGE_MODEL` selecciona `gpt-image-2.5-sunburst` (predeterminado), `gpt-image-2.5-flare` o `gpt-image-2`. La calidad Borrador/Media/Alta corresponde a low/medium/high. Una solicitud produce una imagen, con gastos según el modelo, tamaño, calidad y referencia; no hay lotes ni reintentos automáticos. Configura límites de gasto en tu cuenta de API.

La clave no se devuelve al navegador, no se incluye en los ZIP y no se guarda en el código. No uses variables `PUBLIC_` para ella. El endpoint de esta demo solo admite desarrollo local y peticiones del mismo origen, con una generación simultánea y un límite de cuerpo. En producción permanece desactivado porque la demo no tiene cuentas ni permisos: el anfitrión debe añadir autenticación, autorización, cuotas y su endpoint antes de habilitarlo a usuarios.

### Adaptador reutilizable

```svelte
<script lang="ts">
  import { CharacterGenerator, httpImageProvider } from '@isometrico/character-generator';
  const imageProvider = httpImageProvider('/api/characters/images');
</script>

<CharacterGenerator {imageProvider} />
```

Puedes proporcionar otra implementación de `ImageProvider` con `status()` y `generate(request, signal)`. Sin la prop se conserva el taller manual. `generation.ts` define el contrato, validación y recetas. El adaptador OpenAI de este repositorio está exclusivamente en `src/lib/server/character-images.ts`; usa `images/generations` para el original e `images/edits` con PNG adjunto para las referencias. Los PNG aprobados se reducen a 768 px de lado mayor y hasta 2 MB para reutilizarlos.

Implementación contrastada con la [guía oficial de imágenes](https://developers.openai.com/api/docs/guides/image-generation). Las pruebas del adaptador simulan respuestas; no consumen API ni validan la calidad visual del modelo.

## Flujo guiado y retoque con Piskel

«Ir al siguiente paso» recorre las referencias y ciclos pendientes, empezando por SE y NE. Al importar una hoja puedes usar «Revisar este ciclo» sin completar las demás orientaciones. «Aprobar ciclo y continuar» guarda la revisión en el proyecto y selecciona el siguiente ciclo.

En la aplicación, «Retocar en Piskel» abre el editor local ya incluido con el ciclo separado en fotogramas a resolución final, transparencia y reproducción. «Aplicar al taller» devuelve el PNG directamente al generador. Las capas se combinan; la cantidad de fotogramas y las dimensiones permanecen fijas. La velocidad del visor de Piskel es solo de previsualización; los FPS de salida se ajustan en el generador.

Los retoques se guardan en `edits/` dentro del `.project.zip`, conservando las fuentes originales. Se aplican después de la reducción y la paleta para preservar los píxeles, colores y posición elegidos. Los reflejos se calculan desde el resultado retocado. Para cambiar la cuadrícula o rehacer el acabado, usa «Restaurar desde la fuente original». La revisión y los retoques se guardan en el borrador local; descarga el proyecto actualizado para conservar una copia portátil.

El paquete continúa siendo independiente: recibe un `PixelEditorProvider` opcional; la ruta `/characters` conecta ese contrato con el componente Piskel de la aplicación.

## Vídeo por API: Magnific / Kling 2.6

El anfitrión de `/characters` ofrece **Animar con Kling 2.6**, con `MAGNIFIC_API_KEY` en el `.env` privado. `MAGNIFIC_API_KEY_NAME` es una etiqueta local; `MAGNIFIC_WEBHOOK_SECRET` queda reservado para posibles callbacks. El flujo local usa consultas de estado y no necesita un webhook público. Las claves nunca se envían al navegador ni se guardan en los ZIP.

1. Aprueba una referencia de la orientación que quieres animar. Kling exige al menos 300 × 300 px y proporción entre 1:2,5 y 2,5:1; las referencias generadas por el taller cumplen esas dimensiones.
2. Selecciona acción y orientación. Puedes editar el prompt de vídeo, hasta 2500 caracteres, para repetir el que te funcionó en Magnific.
3. **Generar vídeo** envía una sola referencia a Kling 2.6 Pro: 5 segundos, sin audio. Cada clic consume créditos de Magnific. La API documentada de esta versión no ofrece imagen final; no enviamos ese parámetro.
4. El taller consulta el estado cada 7,5 segundos hasta 20 minutos. Un vídeo nuevo se importa a 24 muestras/segundo y abre la vista previa si sigues en el mismo personaje y vista. Si ya existe una fuente, debes pulsar **Reemplazar ciclo con este vídeo**. Las solicitudes recuperadas requieren importación explícita.
5. Revisa, retoca en Piskel y guarda el proyecto. **Descargar vídeo original** permite conservar el clip completo.

Las solicitudes se registran en `.character-video-jobs/`, excluido de Git. **Recuperar solicitudes de vídeo** permite consultar las últimas 50 incluso después de reiniciar. Cada solicitud tiene un identificador local: repetirla con ese identificador no genera otro vídeo. Si se pierde la respuesta de creación, no se reenvía automáticamente; revisa tu cuenta antes de iniciar otra solicitud. Los vídeos descargados se guardan completos en ese directorio para poder importarlos de nuevo. Las referencias y proyectos del navegador siguen necesitando **Guardar proyecto**; el registro de solicitudes no los sustituye.

Importa los resultados pronto. [Magnific indica que sus enlaces caducan a los 30 minutos](https://docs.magnific.com/quickstart); la copia local solo existe después de descargar o importar el vídeo. Una solicitud pendiente puede seguir ejecutándose en Magnific aunque cierres el taller.

La integración es opcional y el núcleo continúa independiente del proveedor. Un anfitrión puede pasar `videoProvider: VideoProvider` al componente o usar `httpVideoProvider('/api/characters/videos')`. Los métodos son `status`, `list(projectId)`, `create`, `poll` y `video`. La recuperación muestra hasta 50 solicitudes del identificador exacto del personaje abierto, incluyendo sus distintas acciones y vistas. El anfitrión permite desarrollo en loopback y, en producción, acceso privado mediante las credenciales del taller sobre HTTPS. Los POST deben proceder del mismo origen configurado. Consulta el README del repositorio para las variables de Railway.

Contrato comprobado con la documentación de [creación Kling 2.6 Pro](https://docs.magnific.com/api-reference/image-to-video/kling-v2-6-pro) y [consulta de estado](https://docs.magnific.com/api-reference/image-to-video/kling-v2-6/task-by-id). Creación: `POST /v1/ai/image-to-video/kling-v2-6-pro`; consulta: `GET /v1/ai/image-to-video/kling-v2-6/{task_id}`. Las pruebas usan transporte simulado; comprobar la clave mediante una consulta de lectura no valida la calidad de una generación real.

## Empezar desde una foto o un referente

En **01 · Personaje → Subir foto o referencia** puedes cargar PNG, JPG o WebP (hasta 20 MB y 32 megapíxeles). Se normaliza localmente a PNG de hasta 768 px de lado mayor, sin conservar los metadatos del archivo. La foto se incluye en el ZIP de **Guardar proyecto**, junto a las vistas aprobadas, y se recupera al abrirlo. Los proyectos anteriores siguen siendo compatibles.

Con una imagen importada, **Descripción o cambios** es opcional. Elige el estilo y escribe solo lo que quieres modificar; **Generar vista** envía la imagen y esas indicaciones a OpenAI mediante el servicio de imágenes existente. Subir la foto no llama a ninguna API ni crea una descripción textual automática. Sin API puedes conservarla como guía y continuar con las importaciones manuales.

La foto es un punto de partida, sin una orientación aprobada. La primera propuesta debe revisarse y aprobarse; después las vistas aprobadas tienen prioridad para mantener el diseño. Puedes marcar **Usar la foto original para esta propuesta** para volver al referente. Cambiar o quitar la foto no elimina vistas aprobadas ni ciclos existentes. Kling sigue usando exclusivamente la vista aprobada para la orientación seleccionada.

### Acciones por personaje

En «Define la referencia → Acciones del personaje» se seleccionan las acciones con checks dentro de un bloque plegable. Los perfiles isométricos ofrecen idle, walk, work, talk, celebrate, sit, attack, hurt y run; plataformas ofrece las acciones de su tabla anterior. Los proyectos anteriores conservan la selección predeterminada de su perfil. `settings.actions` guarda la selección; desmarcar conserva las fuentes y los retoques en el proyecto editable.

El flujo, los prompts, las vistas pendientes y el ZIP final solo incluyen las acciones seleccionadas. Al aprobar el último ciclo se construyen las hojas seleccionadas. Hurt usa tres fotogramas y puede generarse con el proveedor de imágenes; attack y run usan ocho. La importación manual sigue disponible. Esto no envía generaciones de pago en lote.

El jugador del motor actual requiere idle, walk, work, talk, celebrate y sit. Los paquetes parciales y las acciones adicionales se exportan para otros usos o una integración posterior del motor.

### Configuración extensible y proyectos anteriores

`PROFILES` define cámara, orientación inicial, vistas y recetas. `GeneratorSettings.actionOptions` permite ajustar `frames`, `fps` y `playback` por acción, y `exportFormat` selecciona el contrato de salida. Son campos opcionales: los `.project.zip` anteriores mantienen sus perfiles, selecciones y comportamiento repetitivo. Se conserva la versión 1 del proyecto y todos los datos fuente y retoques. Cambiar el número de fotogramas de una acción con retoques está bloqueado hasta restaurar sus fuentes; FPS y repetición se pueden ajustar sin borrar píxeles.

Los prompts manuales y las solicitudes OpenAI comparten la cámara y las recetas del perfil. Las acciones de hasta cuatro fotogramas conservan tanto imágenes como vídeo, además de importación manual. No se han añadido formatos nativos de otros motores ni el perfil de vista superior en esta primera ampliación.

## Asistente de cinco pasos

El taller muestra una fase cada vez: **Personaje → Vistas → Animaciones → Revisar → Exportar**. Se puede volver a cualquier fase sin descartar las fuentes ni las propuestas de generación. La vista previa permanece al lado en escritorio y sobre el formulario en pantallas pequeñas.

- **Personaje:** sección propia «Formato y dimensiones» con tipo de juego, estilo, ancho/alto del fotograma y altura del personaje. Apoyo, paleta y fondo quedan plegados, y una tabla calcula el tamaño de cada hoja según sus fotogramas y orientaciones. Después se definen la descripción o foto y las acciones. El tamaño del fotograma se bloquea si hay retoques de Piskel. El ejemplo del juego es opcional.
- **Vistas:** importar vistas directamente o generarlas con OpenAI. Las miniaturas distinguen referencias propias y reflejadas. Las referencias se comparten entre acciones de la misma orientación.
- **Animaciones:** elegir generación o importación manual; se mantienen ChatGPT y Kling para acciones de hasta cuatro fotogramas. Los proveedores permanecen montados al cambiar de paso, para conservar propuestas y consultas de vídeos pendientes.
- **Revisar:** vista previa, Piskel, intervalo y ajustes avanzados. Aprobar continúa con la siguiente vista pendiente. Cambiar una referencia marca sus animaciones existentes para revisión sin borrar fuentes ni retoques. Los cambios de procesamiento también requieren revisar de nuevo.
- **Exportar:** construir las hojas y exportar cuando todas las vistas seleccionadas estén aprobadas. El proyecto editable `.project.zip` es una descarga distinta del ZIP de hojas para el juego.

El progreso cuenta vistas de animación aprobadas, incluyendo reflejos únicamente cuando su fuente está aprobada. Una fuente importada para la vista reflejada tiene prioridad y requiere su propia aprobación.

**Recuperación local:** IndexedDB guarda el último borrador de este navegador y origen, con fuentes, retoques, referencias, ajustes y posición en el asistente. Al abrir el taller se ofrece recuperarlo antes de sobrescribirlo. El estado indica cambios pendientes, guardando, última hora de guardado o error. Este borrador no sincroniza ordenadores ni sustituye una copia ZIP; cada nuevo proyecto con cambios sustituye el último borrador local. Los archivos ZIP nuevos guardan `navigation` opcional; los anteriores calculan el paso pendiente al abrirlos.

### Interfaz compacta

El reproductor mantiene el visor estable al avanzar fotogramas: los controles están debajo, con filas fijas y contador de ancho reservado. La revisión conserva el acceso a Piskel y a los ajustes de intervalo, velocidad y posición. El progreso por acción y orientación se consulta en una matriz plegable independiente del visor.

Las referencias se administran en una sola galería. En Animaciones, el selector ofrece Kling, ChatGPT para ciclos de hasta cuatro fotogramas e importación manual según los proveedores disponibles. Calidad, conexión y prompts quedan en desplegables; la información de consumo permanece visible.

Exportar separa las hojas para el juego del proyecto editable. «Generar y descargar hojas» construye y exporta las acciones aprobadas; conserva un enlace de descarga si el navegador no inicia la descarga automáticamente. El proyecto `.project.zip` mantiene las referencias, fotogramas y retoques para continuar editando.

En el paso **Vistas**, **Retocar en Piskel** abre la referencia seleccionada como una sola imagen a su resolución actual. **Aplicar al taller** actualiza la referencia para las próximas generaciones y el borrador/ZIP; cancelar conserva la anterior. Las animaciones existentes se conservan y quedan pendientes de revisión si dependen de esa orientación. Para vistas por reflejo, el botón **Ir a referencia** lleva a la imagen de origen. El ancho, alto y apoyo finales del paso 1 no cambian al retocar una referencia.
