# Interfaz de los editores

El taller de sprites, el editor de mundo y el generador IA comparten colores, controles compactos, paneles laterales y acciones de guardado visibles. El componente neutral `@isometrico/editor-ui` gestiona paneles, cierre, foco y fijación opcional.

## Mundo

La cabecera selecciona la aventura; Más opciones conserva importación, exportación y acceso al taller. Las herramientas quedan arriba y el mapa ocupa el centro. Objetos abre un listado buscable; fijarlo en pantallas amplias mantiene el listado al seleccionar un objeto. El inspector derecho conserva Propiedades, Módulos y Condiciones, incluida la capa de edición de módulos y sus avisos de cambios pendientes. Los paneles flotantes de herramientas permiten seguir pintando el mapa; no son diálogos bloqueantes.

En el pie permanecen mapa actual, deshacer/rehacer, mano, zoom, ajuste, Guardar y Guardar y jugar. El estado diferencia cambios pendientes del contenido guardado. En pantallas estrechas los controles se distribuyen en dos filas y los paneles flotan sobre el lienzo.

## Catálogo de la aventura

«Añadir» del mundo y «Esta aventura» del taller de sprites utilizan `AdventureResourceCatalog` y el mismo modelo de filtrado. La búsqueda encuentra nombres de recursos, familias y aspectos, sin distinguir mayúsculas ni tildes; el filtro de categoría se combina con ella. Las familias son desplegables y los recursos sin familia aparecen por separado. Se conservan el ID, imagen y recorte de cada miembro: el mundo prepara su colocación; el taller abre su edición. Fijar el catálogo del mundo permite seleccionar otro aspecto sin cerrar el panel.

La organización se guarda en el taller y se lee al cargar los recursos de la aventura. El listado «Objetos del mapa» sigue mostrando las instancias ya colocadas. Las bibliotecas «Mi espacio» y «Compartidos», con sus controles de incorporación y ZIP, permanecen en el taller.

## Guion y eventos narrativos

**Mapa / Guion** cambia entre edición espacial y el tablero de toda la aventura. Cada tarjeta de objeto corresponde a una instancia colocada, con su mapa, acción, estados y módulos; reutilizar un sprite no une sus guiones. El tablero muestra también mapas, artículos de inventario y eventos narrativos. Las líneas continuas representan consecuencias o viajes, y las discontinuas requisitos. Seleccionar una tarjeta o relación abre el inspector existente; las reglas siguen siendo las de la aventura, no una copia independiente del guion.

La búsqueda conserva las relaciones inmediatas del resultado; el selector de mapa permite centrarse en una parte de la aventura. Se puede desplazar el fondo, usar zoom o Encajar y mover las tarjetas con arrastre o flechas. **Organizar** distribuye las tarjetas visibles. Las posiciones se guardan con la aventura y viajan en el ZIP; se eliminan de la publicación y no generan por sí solas novedades públicas. La URL `view=story` conserva la vista al recargar.

**Añadir evento narrativo** crea un borrador desactivado. Configura nombre y desencadenante: inicio de aventura o entrada en un mapa. Añade módulos de **Contexto** (título y texto) o **Conversación** (existente o editada con el mismo editor de chat). Los módulos se pueden reordenar; se muestran en secuencia. Añade requisitos y consecuencias si hacen falta, activa el evento y guarda la aventura. Sin módulos, un evento configurado puede ejecutar solo sus consecuencias.

En la partida, el inicio se encola antes del contexto de entrada. Los módulos pausan el movimiento; cerrar una presentación incompleta no la completa ni entrega recompensas. El progreso conserva la ejecución y el módulo actual, incluso tras una recarga. **Una sola vez** impide repetir un evento completado o fallado; desactivarlo permite repetir un contexto al volver a entrar en su mapa. Las consecuencias se aplican únicamente al completar todos los módulos, de forma atómica. Los requisitos de inicio pendientes se vuelven a evaluar en una entrada posterior, sin dispararse en cada redibujado.

El panel de **Pruebas** permite simular el progreso de eventos sin ejecutar contenido ni consecuencias. **Reiniciar aventura** borra también este progreso y sus conversaciones para probar el recorrido real. Al cambiar la configuración durante el desarrollo, reinicia la prueba si necesitas repetir módulos ya completados. Los capítulos y la creación de conexiones arrastrando puertos quedan para una fase posterior.

## Personajes

Los cinco pasos permanecen visibles. La vista central muestra la referencia o la animación; Propiedades abre los campos de la fase activa. Progreso abre la matriz de ciclos. La revisión conserva zoom 1×/2×/3×, reproducción, fotogramas, velocidad y Piskel. Las opciones de IA, recuperación de solicitudes, importación manual y exportaciones siguen en sus fases originales. Guardar copia siempre conserva el proyecto editable ZIP; no publica recursos.

## Desarrollo

Vite utiliza `.svelte-kit/vite-cache` para aislar el optimizador de cada checkout. Así una copia de pruebas que comparte `node_modules` no reemplaza los fragmentos dinámicos de Pixi del servidor principal.
