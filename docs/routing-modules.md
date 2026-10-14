# Módulos de contenido de RoutingTales

Información, Vídeo y Pregunta se han copiado de Passport-Hotel y adaptado al catálogo compartido de objetos y eventos de Isometric. Los reproductores y efectos originales están en `src/lib/modules/routingtales`, con procedencia documentada en su README. Sus API de cuentas, CDN y guardado se sustituyen por el progreso local de esta aventura. No requiere migraciones de base de datos.

## Edición

En Módulos del objeto o Contenido del evento, elegir el tipo y Añadir. El editor ocupa la capa completa del inspector. Contenido, JSON y Probar comparten el mismo borrador; Aplicar módulo lo incorpora al borrador de aventura y Guardar lo conserva en el espacio. Cerrar protege los cambios sin aplicar. Se mantienen el orden, los identificadores y las condiciones que dependen del módulo.

- Contexto: presentación a pantalla completa de hasta 32 diapositivas, con imagen y título opcionales y texto obligatorio para activar el módulo. El nombre del contexto identifica el módulo en el guion. Añadir, quitar y reordenar diapositivas conserva sus identificadores y traducciones. «Probar presentación» abre la misma vista que verá el jugador: imagen arriba sin recortar, texto abajo con desplazamiento cuando es largo, contador y botones Anterior/Siguiente. Las flechas izquierda/derecha también navegan. «Continuar» en la última diapositiva completa el módulo y avanza al siguiente o ejecuta las consecuencias del evento; las páginas intermedias no completan el módulo. Cerrar antes del final permite volver a abrir el contexto desde su primera diapositiva. Admite imágenes incorporadas de hasta 4 MB por archivo (8 MB de datos de imagen por contexto) o URL. Los contextos antiguos con título/texto se muestran como una sola diapositiva y siguen siendo editables. Aplicar al borrador y Guardar conservan la presentación; las imágenes incorporadas viajan dentro del JSON de aventura y de las publicaciones.

- Información: texto enriquecido, contenido por idioma, imagen, audio, vídeo de apoyo, bloques adicionales de texto/imagen y efectos de linterna, lupa, rayos X, rasca y comparación con deslizador. El audio tiene avance/retroceso, velocidad y silencio; puede seguir reproduciéndose mientras se explora el mapa.
- Vídeo: reproducción local o URL, HLS, miniatura, porcentaje mínimo de visionado, repetición y recuperación de errores. YouTube utiliza la confirmación manual «He visto el vídeo», igual que el original; no se afirma que mida el visionado del iframe.
- Pregunta: texto libre, casillas de letras, combinación numérica, combinación de letras y ordenar letras por arrastre. Admite alternativas separadas por |, idiomas, normalización de mayúsculas y acentos, pistas progresivas, multimedia y efectos de imagen. Los intentos pueden ser ilimitados o acabar en Fallado al alcanzar el máximo.

Importar JSON acepta los módulos INFO/VIDEO/QUESTION actuales y los DTO antiguos de información, vídeo y simple-response. Exportar conserva el contenido adaptado, idiomas y opciones. Los campos HTML se sanean antes de mostrarlos o abrir Quill. Los estilos de los reproductores están aislados; `npm run modules:styles` regenera las utilidades.

Los medios pueden usar URL o incorporarse desde un archivo de hasta 4 MB. Los archivos incorporados viajan dentro del JSON y ZIP; el límite existente de la definición de aventura sigue siendo 10 MB. Para vídeos mayores usar una URL accesible a los jugadores. No se copia el gestor de medios/CDN ni las cuentas de Passport-Hotel.

## Progreso y resultados

Cada asociación objeto/módulo o evento/módulo/ejecución tiene su propia clave. Se conservan los resultados finales, los intentos y las pistas usadas. Un módulo pendiente se abre desde el principio: el chat vuelve al primer nodo, la respuesta pendiente se vacía y el vídeo vuelve al segundo cero. El cambio al siguiente módulo no cambia la clave del reproductor que acaba de terminar. Reiniciar la aventura borra progreso y puntuación y detiene el audio; cambiar de aventura o salir también retira su audio y sus callbacks.

Puntos y mensajes de éxito/fallo son configurables. Las pistas suman sus penalizaciones, y por defecto cada respuesta incorrecta resta 10%, como RoutingTales, con límite conjunto del 40%. La penalización por intento es configurable. La puntuación se guarda en el mismo snapshot que las consecuencias y se concede una sola vez por asociación/ejecución. Se muestra en el juego y en Pruebas. Las recompensas de inventario y cambios del mundo siguen usando Condiciones/Reacciones del objeto o las consecuencias del evento, con identificadores de la aventura actual.

## Validación

Probados en navegador los cinco modos de respuesta, el editor y su vista previa, el orden Información → Vídeo, el visionado mínimo, las pistas tras reabrir, la finalización en segundo plano del audio y la puntuación acumulada. Se añaden pruebas de validación/importación, puntos y aislamiento de progreso, y de cancelación de cargas HLS.


## Grupos de módulos

Los objetos y PNJ muestran una lista simple mientras solo hay un grupo. Al añadir el segundo aparecen Grupo 1 y Grupo 2, con los módulos existentes dentro del primero. Cada grupo puede tener condiciones opcionales. Cada grupo contiene uno o varios módulos de cualquier tipo y una rama opcional «Si no…». Se recorren de arriba abajo; todos los bloques que cumplen sus requisitos se reproducen, sin selector de modo ni prioridad entre alternativas.

`EntityBehavior.moduleSequence` conserva referencias a los módulos del catálogo plano `modules`, manteniendo identificadores, chats compartidos, traducciones, progreso y reacciones. El formato conserva los pasos individuales antiguos; un paso es `{kind:'module',moduleId}` o `{kind:'condition',id,when,moduleIds,elseModuleIds?}`. Cada módulo pertenece exactamente a un paso o rama. Los requisitos se validan con las reglas habituales de inventario, estado, progreso de módulo y evento. Los grupos sin requisitos se ejecutan siempre, en orden. Los módulos sueltos antiguos se agrupan consecutivamente al abrir el editor.

Al entrar en un bloque se elige su rama; se termina esa rama aunque un módulo consuma un artículo necesario. Las condiciones de los bloques siguientes se evalúan después de las consecuencias del anterior. Al volver a interactuar se evalúan de nuevo, sin retomar una rama que ya no cumple requisitos. Los módulos sin condiciones conservan su comportamiento secuencial y los eventos narrativos conservan su editor actual.

Las condiciones antiguas de cada módulo aparecen como bloques al abrir el editor, sin cambiar identificadores. Al editar la secuencia se guarda el nuevo formato y desaparece el antiguo selector de funcionamiento. Ya no hay opciones de reutilizar chat ni de repetición en las tarjetas: todo módulo pendiente comienza desde el inicio al abrirse. Los resultados completados/fallados y las reacciones de una sola vez se conservan. El campo histórico `repeat` se acepta al importar, pero no cambia este comportamiento.

Para una llave, crear un bloque «Si tiene Llave × 1» con el contenido del secreto y añadir «Si no…» con el chat pidiendo buscarla. La llave es un recogible vinculado al artículo del inventario. Si se entrega y consume, usar un estado permanente del PNJ para recordar la entrega. El tablero dibuja las dependencias de los bloques.
