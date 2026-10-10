# Módulos de contenido de RoutingTales

Información, Vídeo y Pregunta se han copiado de Passport-Hotel y adaptado al catálogo compartido de objetos y eventos de Isometric. Los reproductores y efectos originales están en `src/lib/modules/routingtales`, con procedencia documentada en su README. Sus API de cuentas, CDN y guardado se sustituyen por el progreso local de esta aventura. No requiere migraciones de base de datos.

## Edición

En Módulos del objeto o Contenido del evento, elegir el tipo y Añadir. El editor ocupa la capa completa del inspector. Contenido, JSON y Probar comparten el mismo borrador; Aplicar módulo lo incorpora al borrador de aventura y Guardar lo conserva en el espacio. Cerrar protege los cambios sin aplicar. Se mantienen el orden, los identificadores y las condiciones que dependen del módulo.

- Información: texto enriquecido, contenido por idioma, imagen, audio, vídeo de apoyo, bloques adicionales de texto/imagen y efectos de linterna, lupa, rayos X, rasca y comparación con deslizador. El audio tiene avance/retroceso, velocidad y silencio; puede seguir reproduciéndose mientras se explora el mapa.
- Vídeo: reproducción local o URL, HLS, miniatura, porcentaje mínimo de visionado, repetición y recuperación de errores. YouTube utiliza la confirmación manual «He visto el vídeo», igual que el original; no se afirma que mida el visionado del iframe.
- Pregunta: texto libre, casillas de letras, combinación numérica, combinación de letras y ordenar letras por arrastre. Admite alternativas separadas por |, idiomas, normalización de mayúsculas y acentos, pistas progresivas, multimedia y efectos de imagen. Los intentos pueden ser ilimitados o acabar en Fallado al alcanzar el máximo.

Importar JSON acepta los módulos INFO/VIDEO/QUESTION actuales y los DTO antiguos de información, vídeo y simple-response. Exportar conserva el contenido adaptado, idiomas y opciones. Los campos HTML se sanean antes de mostrarlos o abrir Quill. Los estilos de los reproductores están aislados; `npm run modules:styles` regenera las utilidades.

Los medios pueden usar URL o incorporarse desde un archivo de hasta 4 MB. Los archivos incorporados viajan dentro del JSON y ZIP; el límite existente de la definición de aventura sigue siendo 10 MB. Para vídeos mayores usar una URL accesible a los jugadores. No se copia el gestor de medios/CDN ni las cuentas de Passport-Hotel.

## Progreso y resultados

Cada asociación objeto/módulo o evento/módulo/ejecución tiene su propia clave. Se conservan intentos, pistas usadas, respuesta y posición/porcentaje del vídeo. El cambio al siguiente módulo no cambia la clave del reproductor que acaba de terminar. Reiniciar la aventura borra progreso y puntuación y detiene el audio; cambiar de aventura o salir también retira su audio y sus callbacks.

Puntos y mensajes de éxito/fallo son configurables. Las pistas suman sus penalizaciones, y por defecto cada respuesta incorrecta resta 10%, como RoutingTales, con límite conjunto del 40%. La penalización por intento es configurable. La puntuación se guarda en el mismo snapshot que las consecuencias y se concede una sola vez por asociación/ejecución. Se muestra en el juego y en Pruebas. Las recompensas de inventario y cambios del mundo siguen usando Condiciones/Reacciones del objeto o las consecuencias del evento, con identificadores de la aventura actual.

## Validación

Probados en navegador los cinco modos de respuesta, el editor y su vista previa, el orden Información → Vídeo, el visionado mínimo, las pistas tras reabrir, la finalización en segundo plano del audio y la puntuación acumulada. Se añaden pruebas de validación/importación, puntos y aislamiento de progreso, y de cancelación de cargas HLS.
