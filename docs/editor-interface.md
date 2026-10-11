# Interfaz de los editores

El taller de sprites, el editor de mundo y el generador IA comparten colores, controles compactos, paneles laterales y acciones de guardado visibles. El componente neutral `@isometrico/editor-ui` gestiona paneles, cierre, foco y fijación opcional.

## Mundo

La cabecera selecciona la aventura; Más opciones conserva importación, exportación y acceso al taller. Las herramientas quedan arriba y el mapa ocupa el centro. Objetos abre un listado buscable a la derecha; seleccionar un objeto sustituye el listado por sus propiedades. La búsqueda se conserva al volver a abrir Objetos. El inspector derecho conserva Propiedades, Módulos y Condiciones, incluida la capa de edición de módulos y sus avisos de cambios pendientes. Añadir, Jugador, Inventario, Objetos, Aventuras, Mapas, Terreno y las propiedades del mapa, elementos y eventos comparten el lateral derecho: se muestra un solo panel cada vez y reduce el área del mapa, sin superponerse ni bloquear la pintura.

En el pie permanecen mapa actual, deshacer/rehacer, mano, zoom, ajuste, Guardar y Guardar y jugar. El estado diferencia cambios pendientes del contenido guardado. En pantallas estrechas los controles se distribuyen en dos filas. Con menos de 640 px disponibles, el panel se coloca debajo del mapa y comparte la altura del área de trabajo, manteniendo el lienzo visible e interactivo. Cerrar el panel devuelve espacio al mapa.

## Catálogo de la aventura

«Añadir» del mundo y «Esta aventura» del taller de sprites utilizan `AdventureResourceCatalog` y el mismo modelo de filtrado. La búsqueda encuentra nombres de recursos, familias y aspectos, sin distinguir mayúsculas ni tildes; el filtro de categoría se combina con ella. Las familias son desplegables y los recursos sin familia aparecen por separado. Se conservan el ID, imagen y recorte de cada miembro: el mundo prepara su colocación; el taller abre su edición. En pantallas amplias el catálogo del mundo permite seleccionar otro aspecto sin cerrar el panel.

La organización se guarda en el taller y se lee al cargar los recursos de la aventura. El listado «Objetos del mapa» sigue mostrando las instancias ya colocadas. Las bibliotecas «Mi espacio» y «Compartidos», con sus controles de incorporación y ZIP, permanecen en el taller.

## Guion y eventos narrativos

**Mapa / Guion** cambia entre edición espacial y el tablero de toda la aventura. Cada tarjeta de objeto corresponde a una instancia colocada, con su mapa, acción, estados y módulos; reutilizar un sprite no une sus guiones. El tablero muestra también mapas, artículos de inventario y eventos narrativos. Las líneas continuas representan consecuencias o viajes, y las discontinuas requisitos. Seleccionar una tarjeta o relación abre el inspector existente; las reglas siguen siendo las de la aventura, no una copia independiente del guion.

La búsqueda conserva las relaciones inmediatas del resultado; el selector de mapa permite centrarse en una parte de la aventura. Se puede desplazar el fondo, usar zoom o Encajar y mover las tarjetas con arrastre o flechas. Las tarjetas pueden cruzar el origen hacia cualquier dirección. Al arrastrarlas cerca de un borde, el tablero se desplaza automáticamente; Encajar recupera toda la distribución, incluidas posiciones negativas. Cancelar un gesto no guarda el movimiento de la tarjeta. **Organizar** distribuye las tarjetas visibles. Las posiciones se guardan con la aventura y viajan en el ZIP; se eliminan de la publicación y no generan por sí solas novedades públicas. La URL `view=story` conserva la vista al recargar.

**Añadir evento narrativo** crea un borrador desactivado. Configura nombre y desencadenante: inicio de aventura o entrada en un mapa. Añade módulos de **Contexto** (título y texto) o **Conversación** (existente o editada con el mismo editor de chat). Los módulos se pueden reordenar; se muestran en secuencia. Añade requisitos y consecuencias si hacen falta, activa el evento y guarda la aventura. Sin módulos, un evento configurado puede ejecutar solo sus consecuencias.

En la partida, el inicio se encola antes del contexto de entrada. Los módulos pausan el movimiento; cerrar una presentación incompleta no la completa ni entrega recompensas. El progreso conserva la ejecución y el módulo actual, incluso tras una recarga. **Una sola vez** impide repetir un evento completado o fallado; desactivarlo permite repetir un contexto al volver a entrar en su mapa. Las consecuencias se aplican únicamente al completar todos los módulos, de forma atómica. Los requisitos de inicio pendientes se vuelven a evaluar en una entrada posterior, sin dispararse en cada redibujado.

El panel de **Pruebas** permite simular el progreso de eventos sin ejecutar contenido ni consecuencias. **Reiniciar aventura** borra también este progreso y sus conversaciones para probar el recorrido real. Al cambiar la configuración durante el desarrollo, reinicia la prueba si necesitas repetir módulos ya completados. Los capítulos y la creación de conexiones arrastrando puertos quedan para una fase posterior.

## Personajes

Los cinco pasos permanecen visibles. La vista central muestra la referencia o la animación; Propiedades abre los campos de la fase activa. Progreso abre la matriz de ciclos. La revisión conserva zoom 1×/2×/3×, reproducción, fotogramas, velocidad y Piskel. Las opciones de IA, recuperación de solicitudes, importación manual y exportaciones siguen en sus fases originales. Guardar copia siempre conserva el proyecto editable ZIP; no publica recursos.

## Desarrollo

Vite utiliza `.svelte-kit/vite-cache` para aislar el optimizador de cada checkout. Así una copia de pruebas que comparte `node_modules` no reemplaza los fragmentos dinámicos de Pixi del servidor principal.

Objetos y eventos comparten el catálogo de módulos (Contexto y Conversación), su formulario y su reproductor. La lista permite añadir varias instancias, reordenarlas, editar en una capa propia, quitar una instancia o reutilizar una conversación de la aventura. El progreso pertenece a cada asociación, aunque el contenido se reutilice. Los módulos de un objeto viven en `story.entities[].modules`; la interacción de los chats antiguos se adapta al identificador histórico `chat` sin cambiar su progreso ni las condiciones que lo referencian.

Los módulos de un objeto se ejecutan en orden al interactuar y retoman el módulo pendiente al volver a abrirlos. Las reacciones siguen pudiendo referirse al identificador de cada módulo. Quitar un módulo utilizado por una condición o reacción exige corregir primero esa referencia. Los eventos conservan sus requisitos, frecuencia y consecuencias al finalizar su secuencia. Un contexto sin texto o conversación sin configurar queda como borrador y no puede reproducirse; un evento incompleto permanece desactivado. Cambiar el contenido compartido de una conversación actualiza todas sus asociaciones; el formulario indica cuántas la usan.

El catálogo común incluye también Información, Vídeo y Pregunta de RoutingTales, con edición en su propia capa, JSON y vista previa. Ver [Módulos de RoutingTales](routing-modules.md) para sus opciones, progreso y medios.

## Generador de personajes

Las propiedades y el progreso comparten un panel lateral derecho que ocupa espacio dentro del taller, sin fondo bloqueante ni superposición sobre la vista previa. Con al menos 960 px disponibles en el área de trabajo, las propiedades aparecen abiertas por defecto; pueden cerrarse para ampliar la vista. En ventanas más estrechas se abren con «Propiedades» o el contador de progreso. Por debajo de 600 px, el panel ocupa el área de trabajo mientras está abierto y el botón o el cierre devuelve la vista previa. Los pasos y las acciones del pie permanecen accesibles; cerrar el panel no descarta los campos ni el proyecto. Escape cierra el panel cuando el foco está dentro de él.

Al cambiar de paso, acción u orientación se conserva la apertura del panel: si estaba abierto, muestra las propiedades de la nueva selección; si estaba cerrado, permanece cerrado. Las secciones desplegables mantienen su estado al volver a un paso durante la sesión. Seleccionar una animación desde Progreso cambia el panel a sus propiedades sin cerrarlo.

En Animaciones, seleccionar una acción y orientación con fotogramas existentes prepara automáticamente la vista previa local, también para vistas reflejadas. No genera imágenes ni vídeos nuevos. Si la preparación falla, conserva el aviso y la opción manual de abrir la revisión.

## Propiedades del taller de sprites

El inspector de propiedades, IA e imagen fuente ocupa el lateral derecho del área de trabajo y reduce la vista previa, sin diálogo ni fondo bloqueante. Se abre por defecto si el área disponible tiene al menos 960 px. En ventanas más estrechas se abre con «Propiedades»; por debajo de 600 px, ocupa el área de la vista previa hasta cerrarlo. La cabecera del recurso, los tipos y el guardado siguen accesibles. La apertura se conserva al cambiar de recurso, aspecto o tipo, incluido al elegir desde el catálogo. Los avisos de cambios pendientes, la validación y el editor de Piskel se mantienen.

El botón «Propiedades» del editor de mundo permite ocultar y recuperar el inspector sin perder el elemento seleccionado. Seleccionar un objeto en el mapa, listado o guion abre automáticamente su inspector, también si estaba cerrado. Abrir las propiedades del mapa explícitamente vuelve a mostrar el inspector. La edición de módulos sigue ocupando la capa interna del mismo panel, con sus avisos de cambios pendientes.

El inspector es contextual: al entrar en modo de selección sin elemento, o al pulsar el fondo del mapa, muestra Aventuras en el lateral derecho. Seleccionar un objeto muestra su inspector. Las propiedades del mapa siguen en su botón específico; las herramientas de pintura y colocación mantienen su panel mientras están activas. El inspector se puede cerrar manualmente y vuelve a abrirse al seleccionar.

## Cabeceras y selección contextual

Las cabeceras del editor de mundo muestran solo el cierre; no hay flecha de minimización ni chincheta. El listado de objetos y el catálogo se sustituyen por las propiedades al seleccionar o colocar un objeto; sus botones de la barra permiten recuperarlos. «Más opciones» ofrece acceso explícito a Ajustes de la aventura y Gestionar mapas.

Pulsar una casilla selecciona su suelo, con controles de textura, altura y escalera que modifican solo esa casilla. Pulsar una pared o puerta abre su contexto de construcción. «Terreno» conserva el modo de pintura para el mapa completo. El espacio vacío fuera del suelo sigue mostrando Aventuras, y el arrastre sigue desplazando la cámara. Los módulos se abren desde la pestaña Módulos del elemento o del evento, y mantienen sus avisos antes de descartar.

## Catálogo compacto del taller

La cabecera del catálogo contiene el selector Esta aventura/Mi espacio/Compartidos, el menú de creación (+) y el cierre. No repite el nombre de la aventura ni muestra chincheta. Todos los ámbitos usan un panel de 340 px; en ventanas amplias ocupa espacio a la izquierda del taller y, en ventanas estrechas, se abre sobre él. Cerrar siempre devuelve ese espacio.

Tipos, búsqueda, contador y filtro de categoría comparten `CatalogBrowser`. La categoría se abre desde el icono de filtros y aparece como etiqueta eliminable cuando está activa. Jugadores y suelos no heredan categorías de objetos/PNJ. El buscador normaliza mayúsculas y acentos también en las bibliotecas. Se conservan búsqueda, categoría y posición de desplazamiento por tipo y ámbito durante la sesión. Solo se desplaza el listado; los controles quedan visibles.

Mi espacio y Compartidos muestran filas con miniatura, nombre y acciones de incorporar o descargar. El menú junto al buscador mantiene actualizar, importar ZIP (solo Mi espacio) y exportar biblioteca. Incorporar continúa creando una copia independiente en la aventura y mantiene el aviso de cambios sin guardar. Las familias de la aventura conservan miembros, selección y recortes. El menú + mantiene crear el tipo actual e importar ZIP del personaje; los nuevos recursos se crean en la aventura, también cuando se consulta una biblioteca. El estado vacío de Compartidos explica que los recursos los publica el superadmin.

La biblioteca independiente `/library` conserva su presentación completa y sus acciones. El catálogo del editor de mundo utiliza los mismos controles de búsqueda y categoría, con sus tipos habituales y sin cambiar la colocación de objetos.
