# Taller de recursos y calibración de sprites

Estado: primera versión implementada. El resto del documento conserva los criterios de evolución.

## Disponible

- `/sprites?adventure=…` y `/resources?adventure=…` abren el mismo taller, con biblioteca por aventura y pestañas Objetos, PNJ, Jugador y Suelos.
- Importación de PNG original, recorte por coordenadas o eliminación de transparencia dentro de la selección, escala proporcional o dimensiones independientes, apoyo numérico o arrastrando sobre la retícula y huella predeterminada.
- Alta de objetos y PNJ, variantes, miniaturas recortadas, búsqueda y consulta de los mapas que los usan. Se impide borrar recursos colocados y al jugador activo.
- Nombre y categoría editables en los objetos base. La personalización pertenece a la aventura y se conserva en el ZIP; el taller y el editor resuelven el mismo catálogo. Los nuevos objetos toman ese nombre al colocarlos; los ya colocados conservan su nombre propio.
- PNJ estático válido por sí mismo. `idle` y `talk` son hojas opcionales e independientes; sin `talk`, conserva el reposo. Los PNJ de la demo también pueden editarse.
- Jugadores con las seis acciones comunes y cuatro filas NE, SE, SW, NW. Cada acción tiene su imagen, primera fila, fotogramas y FPS. La escala y el apoyo son comunes. Se puede reutilizar el primer fotograma de trabajar para sentarse. Guardar una variante y activarla son acciones separadas.
- Alta, duplicación, sustitución y recorte de suelos con mosaico de referencia. Las nueve texturas base se mantienen y cada aventura admite hasta 128 suelos propios. Los nuevos suelos aparecen en Baldosas del editor con su nombre y miniatura recortada; el motor aplica el mismo recorte en el juego. Se impide borrarlos mientras estén pintados en algún mapa.
- Guardado conjunto de catálogo, metadatos gráficos e imágenes en IndexedDB. Un borrador por aventura permite conservar una importación incompleta sin aplicarla al juego. Cambios pendientes protegidos al navegar y comprobación de conflictos entre pestañas al guardar recursos.
- Exportación e importación ZIP conservan originales, recortes, huellas, animaciones y jugador activo. Los borradores quedan en el navegador y no se exportan.

Las comprobaciones incluyen los límites de imagen y fotogramas, referencias de catálogo, las cuatro combinaciones de animaciones de PNJ, PNG originales tras exportar/importar y compatibilidad con los paquetes anteriores. El motor sigue sin depender de IndexedDB, Prisma ni de las aplicaciones anfitrionas.

Pendiente: editor de píxeles, texturas de paredes y exportar un PNG normalizado a partir de la receta. El calibrador actual guarda la receta y el original; la descarga entrega el original.

Los suelos propios usan claves estables `custom.*` en `PixelArtPack.tiles`; `tileNames` conserva sus nombres y `tileFrames` su recorte. Las casillas del mapa guardan la clave, de modo que renombrar o cambiar la textura actualiza su apariencia sin repintar. El ZIP transporta también los PNG utilizados exclusivamente por suelos propios. La entrada `section=tile` abre directamente esta sección desde el editor.

`Adventure.catalogOverrides` guarda nombre (`label`) y categoría de las entradas base `pixel.*`. `resolveVisualCatalog` combina esos metadatos con el catálogo base y los recursos propios de la aventura. La validación admite únicamente esos dos campos para mantener referencias y tipos estables. El guardado del taller detecta también cambios de metadatos hechos en otra pestaña.

## Objetivo

Convertir `/sprites` en el punto de entrada para consultar, incorporar y ajustar los gráficos de una aventura. El resultado debe poder colocarse desde el editor, verse igual en el juego y viajar en el ZIP de la aventura. La gestión local debe poder sustituirse por la de Checkpoint o Routingtales.

## Alcance acordado

- El jugador usa las acciones actuales: reposo (`idle`), caminar (`walk`), sentarse (`sit`), trabajar (`work`), conversar (`talk`) y celebrar (`celebrate`).
- Un PNJ solo necesita una imagen estática; reposo (`idle`) y conversación (`talk`) son animaciones opcionales e independientes. No se le exigen las acciones ni las cuatro direcciones del jugador.
- El repertorio y los requisitos de cada perfil (jugador o PNJ) se definen para todo el sistema. El taller configura sus gráficos, sin permitir crear acciones arbitrarias por personaje. Cualquier cambio futuro del repertorio se aplicará globalmente.
- Las texturas de paredes quedan para una fase posterior. El taller inicial se centra en objetos, personajes/PNJ y suelos.

## Punto de partida anterior a esta entrega

- `/sprites` usa el catálogo estático de la demo y permite probar hojas sin guardarlas.
- `/resources` usa los recursos de la aventura y guarda sustituciones PNG con las mismas dimensiones.
- `PixelArtPack.objects` ya distingue imagen, recorte opcional, dimensiones de dibujo y origen.
- `visualCatalog`, el validador de mapas y el selector del editor admiten una lista fija de recursos.
- La proyección usa casillas de 64 × 32 unidades visuales antes del zoom de cámara.

## Flujo propuesto

1. Elegir la aventura y consultar su biblioteca: catálogo base más recursos propios.
2. Pulsar «Añadir recurso» o «Duplicar y editar» desde una ficha existente.
3. Subir un PNG y seleccionar el sprite si procede de una hoja.
4. Indicar nombre, categoría y huella en casillas.
5. Calibrar escala y apoyo en una escena de referencia.
6. Guardar y abrir el editor para colocar el recurso.

El taller reúne las funciones actuales de recursos y sprites. Las categorías principales son Objetos, Personajes y Suelos. Personajes ofrece dos perfiles: Jugador y PNJ; el perfil PNJ abre un importador simplificado. Materiales de paredes se reserva para una fase posterior. La primera entrega implementa altas y calibración para objetos estáticos; el visor de animaciones se conserva.

## Importación adaptada al tipo de recurso

La clasificación es explícita. El archivo y sus dimensiones pueden sugerir un tipo o una cuadrícula, pero no determinan por sí solos si una imagen representa un personaje, un objeto o una textura. Mostrar y permitir corregir esa sugerencia antes de transformar el recurso.

| Tipo | Configuración específica | Prueba antes de guardar |
| --- | --- | --- |
| Objeto estático | Recorte, escala, apoyo, huella y categoría | Junto al personaje, sobre su huella y detrás/delante de otros objetos |
| Jugador | Dimensiones de fotograma, filas/direcciones, clips para las seis acciones comunes, FPS, apoyo y escala común | Las seis acciones actuales en las cuatro direcciones |
| PNJ | Imagen estática, escala y apoyo; `idle` y `talk` opcionales | Reposo y conversación con las animaciones disponibles o la imagen estática |
| Baldosa de suelo | Recorte, ajuste a la proyección isométrica y alineación de bordes | Mosaico de varias casillas con juntas visibles |
| Material de paredes, en una fase posterior | Imagen repetible o paleta, escala de repetición y orientación | Pared de referencia con iluminación y uniones |
| Objeto animado, en una fase posterior | Huella, apoyo común y secuencia de fotogramas | Bucle de animación en el escenario |

Subir una hoja es una forma de suministrar imágenes, no un tipo de entidad del juego: una hoja puede contener personajes, objetos o baldosas.

La biblioteca y el inspector comparten acciones de importar, duplicar, descargar, retocar y consultar usos. Cada tipo aporta sus campos, validación y escena de prueba. Las opciones no implementadas deben identificarse como tales, sin aparentar que la importación ya tiene efecto en el mundo.

## Personajes y PNJ

Un personaje gráfico define su apariencia y animaciones. Jugador y PNJ son perfiles con requisitos diferentes; pueden compartir imágenes o clips compatibles. Varias instancias de PNJ pueden compartir apariencia y tener nombres, conversaciones y objetivos diferentes.

Actualmente `CharacterPack` es único por paquete y las variantes comparten dimensiones, apoyo y definición de clips. Además, la elección de variante está ligada al color del actor. Para incorporar personajes con gráficos distintos hay que resolverlos por identificador estable, con su propia configuración de fotogramas, imágenes y velocidades dentro del mismo repertorio de acciones. Mantener un personaje predeterminado compatible con las aventuras anteriores.

El importador admite una hoja por acción o una hoja que contenga varias acciones. El usuario asigna direcciones y rangos de fotogramas; la vista previa hace visible esa asignación. El tamaño del fotograma fuente es independiente de la escala del personaje en el mundo. Aplicar escala y apoyo coherentes a todas las acciones para evitar saltos al cambiar de animación.

El perfil Jugador debe resolver las seis acciones comunes en las cuatro direcciones actuales: NE, SE, SW y NW. Su inspector presenta esos seis espacios fijos e indica cuáles están completos. Sentarse puede reutilizar el primer fotograma de trabajar, como sucede en el catálogo actual, o referenciar una imagen propia; esa reutilización debe quedar visible. Si falta la configuración de otra acción o dirección requerida, el recurso permanece como borrador. No inventar orientaciones de espalda ni aplicar espejado automático a personajes asimétricos sin revisión.

El perfil PNJ muestra la imagen estática y el calibrador de escala/apoyo. Dos apartados opcionales permiten incorporar `idle` y `talk`; solo al activarlos se muestran los campos de fotogramas y velocidad. Una imagen con una sola orientación es suficiente. En reposo reproduce `idle` si existe; de lo contrario muestra la imagen estática. Al conversar reproduce `talk` si existe, y en su ausencia conserva su representación de reposo (`idle` o imagen estática). Al terminar la conversación vuelve al reposo. Un PNJ estático es un recurso completo y utilizable; no se considera un borrador por carecer de animaciones. Debe poder guardarse, renderizarse y exportarse sin fabricar hojas para las seis acciones del jugador.

La lógica de conversaciones, tareas, rutas y permisos pertenece al mapa o a la aplicación anfitriona. Las plantillas del taller pueden incluir valores iniciales, pero sus imágenes no deben depender de identificadores de usuarios o tareas de Checkpoint/Routingtales.

## Texturas del mundo

Distinguir una baldosa isométrica ya dibujada de una imagen plana repetible. La primera se alinea sobre la retícula; la segunda necesita una superficie de destino y una transformación para aplicarse sobre ella. El tipo elegido determina cómo se presenta y se procesa.

Los suelos actuales usan imágenes de `PixelArtPack.tiles` asociadas a tipos fijos de terreno. Sustituir la apariencia de uno de esos tipos se puede construir sobre esa base. Añadir nuevos tipos de suelo requiere ampliar también los identificadores aceptados por el mapa, el pintado y los paquetes portables. La textura por sí sola no cambia si una baldosa es transitable.

Las paredes quedan fuera del alcance inicial. Actualmente se dibujan por geometría y paletas, con detalles procedurales de cristal y piedra. Admitir texturas subidas en una fase posterior exigirá implementar repetición, orientación y recorte en esas caras.

## Borradores, sustituciones y retoques

Una importación incompleta permanece como borrador y no aparece entre los recursos listos para colocar. La validación depende del tipo y perfil: un PNJ estático no necesita acciones ni direcciones adicionales. Mostrar problemas concretos: falta una dirección requerida del jugador, un fotograma sale del recorte o falta una imagen referenciada. Validar antes de añadir al catálogo utilizable y al exportar.

Al sustituir un recurso, conservar su identificador y revisar la nueva configuración junto a la anterior. Mostrar cuántos objetos o mapas se verán afectados y permitir crear una variante con un identificador nuevo. Las sustituciones de una textura compartida deben indicar que afectarán a todas sus casillas de uso en esa aventura.

Un editor de píxeles ligero puede añadirse a este flujo como «Retocar». Su primera versión se limita a lápiz, borrador, cuentagotas, relleno, sustitución de color y deshacer/rehacer. Conserva el original y, en animaciones, las dimensiones y alineación del fotograma. Las herramientas de calibración no dependen de que este editor esté implementado.

## Espacio de calibración

- Biblioteca filtrable a la izquierda, vista previa central e inspector a la derecha.
- Vista previa con suelo isométrico, huella del objeto, personaje de referencia y fondo transparente opcional.
- Escala del objeto independiente del zoom de la vista previa.
- Proporciones bloqueadas por defecto; controles de porcentaje, dimensiones y pasos de ampliación entera.
- Ajuste inicial sugerido a partir del contenido visible, excluyendo márgenes transparentes; siempre revisable.
- Controles para ajustar el dibujo a la huella y arrastrar su punto de apoyo.
- El punto de apoyo se coloca sobre una referencia conocida de la huella; se convierte al origen local usado por el renderizador. El centro inferior de la imagen es solo una sugerencia inicial.
- Vista a tamaño nativo para valorar la nitidez del píxel y vista junto al personaje para valorar las proporciones.
- Opciones de restaurar el original y de comparar antes/después.

Una huella de 1 × 1 no impone una imagen de 64 × 32 px: define la base en el suelo. Árboles, llaves y personas necesitan proporciones diferentes. Las copas y otros salientes pueden exceder esa base.

## Tratamiento de imágenes

Conservar el original y guardar la receta de recorte, escala y apoyo. El motor puede usar las dimensiones de dibujo y el origen sin reescribir el PNG en cada ajuste.

El recorte automático se propone para objetos estáticos; en animaciones debe preservarse una alineación compartida entre fotogramas. No recortar cada fotograma de manera independiente.

El modo píxel usa muestreo sin suavizado. Los aumentos enteros preservan mejor una cuadrícula regular; una reducción puede perder detalle. Si se necesita exportar un PNG normalizado, generar una copia derivada del original y la receta.

El calibrador adapta tamaño y posición. No transforma automáticamente una vista frontal en isométrica ni homogeneiza el estilo artístico de los recursos.

## Catálogo ampliable

Separar tres conceptos:

- Recurso gráfico: imagen original, recorte, tamaño de dibujo y apoyo; después, animaciones.
- Entrada del catálogo: identificador estable, nombre, categoría, recurso gráfico y huella predeterminada.
- Objeto del mapa: referencia al catálogo, posición, orientación y comportamiento de esa instancia.

El catálogo base y las entradas propias se resuelven juntos. Los identificadores propios no dependen de los nombres ni de los índices de la lista. Validación, renderizado, editor y exportación deben usar el mismo catálogo resuelto, sin aceptar referencias inexistentes.

Añadir una clase genérica de objeto evita tener que modificar el motor cada vez que se incorpora una decoración. Recoger, conversar o abrir una salida se configura en la instancia o en un preset explícito, independientemente del PNG.

Editar escala o imagen de una entrada afecta a sus instancias: mostrar los usos antes de guardar y ofrecer duplicar para crear una variante. Cambiar su huella solo modifica el valor predeterminado de las nuevas instancias, salvo una operación explícita de actualización de mapas. Impedir borrar entradas usadas sin resolver esas referencias.

Mantener compatibilidad con mapas existentes. La definición portable incluye las entradas propias y sus imágenes; conservar los datos necesarios para reabrir la calibración después de importar el ZIP.

## Almacenamiento e integración

Inicialmente, cada aventura posee sus recursos en IndexedDB y los exporta con el paquete actual. Evitar una biblioteca global implícita que haga depender una aventura de otra.

Ampliar el contrato del repositorio para leer y guardar catálogo, imágenes y recetas conjuntamente. Checkpoint o Routingtales podrán implementar ese contrato con su API y almacenamiento de archivos. Prisma almacenaría referencias y metadatos según la aplicación anfitriona; el motor recibe el catálogo resuelto y no conoce esa persistencia.

## Primera entrega verificable

Implementar PNG individual para objetos estáticos: alta, duplicación, recorte, escala proporcional, apoyo, huella, categoría y guardado en la aventura. Unificar los accesos del taller y recursos.

La entrega se considera completa al poder subir un objeto de dimensiones distintas a las actuales, calibrarlo junto al personaje, colocarlo varias veces, jugarlo y exportar/importar la aventura conservando su apariencia, huella y orientación. Comprobar también que las aventuras anteriores siguen cargando y que los recursos propios se mantienen aislados por aventura.

## Secuencia de entregas

1. Catálogo ampliable con recursos tipados, biblioteca unificada y flujo completo para objetos estáticos.
2. Sustitución y calibración de suelos existentes; vista de repetición y ampliación a tipos propios de baldosa.
3. Biblioteca de personajes con configuración gráfica individual: Jugador con seis acciones en cuatro direcciones; PNJ con imagen estática y `idle`/`talk` opcionales. Verificar también las cuatro combinaciones de PNJ (estático, solo `idle`, solo `talk`, ambas), la vuelta al reposo y su exportación/importación.
4. Materiales con texturas para paredes y objetos animados, con sus ampliaciones explícitas del motor.
5. Retoque de píxeles integrado, una vez estable el guardado de originales y variantes.

Cada entrega debe cerrar el recorrido de importación, validación, guardado, uso en el editor, juego y exportación/importación. Versionar el formato cuando cambien sus contratos y mantener migraciones para las aventuras existentes.
