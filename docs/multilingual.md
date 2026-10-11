# Multidioma: interfaz y contenido

La interfaz admite español e inglés. El selector global y el de las ventanas del juego cambian el idioma sin navegar ni recargar. La preferencia se guarda en la cookie `isometric_locale`; al entrar por primera vez se usa Accept-Language y, si no hay coincidencias, español. Cada petición y cada árbol de componentes mantienen su propio contexto, sin estado global de visitante en el servidor. El HTML inicial indica su idioma y varía por Cookie y Accept-Language.

## Interfaz y compilación

Los catálogos `messages/es.json` y `messages/en.json` se compilan con Paraglide. El complemento de formato se carga desde node_modules, sin descargar código de un CDN durante la compilación. `npm run i18n:compile`, los comandos de check/test y el complemento de Vite generan `src/lib/paraglide`; ese directorio no se versiona. `src/lib/i18n/messages.ts` enlaza los textos existentes con IDs estables para migrar gradualmente. Los textos desconocidos conservan su valor original.

La interfaz admite español e inglés en catálogo, acceso, cuenta, administración, superadministración, biblioteca, editor de mundo, talleres de sprites y personajes, formularios de módulos y controles del juego. El contenido del autor, nombres de recursos, identificadores, prompts y exportaciones conservan sus valores originales. Los textos de proveedores y las interfaces externas embebidas pueden mantener su idioma propio. La historia se traduce manualmente; no se generan traducciones ni imágenes automáticamente.

## Idioma del contenido

Una aventura puede declarar `localization: { defaultLocale: 'es', locales: ['es', 'en'], translations: {...} }`. Sin este campo, las aventuras existentes siguen usando español. En Editor de mundo → Aventuras → Idiomas de la aventura se habilitan los idiomas y se declara el original. Los idiomas se habilitan y añaden exclusivamente en la aventura. Info/Vídeo/Pregunta muestran pestañas solo para los idiomas habilitados; con un único idioma no hay selector. Cambiar de pestaña conserva el borrador de cada versión, y las traducciones nativas importadas de otros idiomas se conservan aunque no se muestren hasta habilitarlos. La sección Traducciones en esos mismos ajustes reúne nombres, descripciones, estados, inventario, eventos, Contexto, conversaciones y contenido de Info/Vídeo/Pregunta. Incluye búsqueda, filtros por sección y pendientes/desactualizados y cobertura por idioma. El original es de solo lectura; el contenido enriquecido se edita con formato. Los cambios se incluyen en el guardado normal y el historial agrupa las pulsaciones de cada edición.

El selector del jugador cambia solo el contenido. El parámetro `?lang=en` permite compartirlo en ese idioma, con fallback al original si no está habilitado. La interfaz mantiene su preferencia independiente. Durante una conversación Chat abierta, el idioma del contenido se cambia al cerrar la conversación; su posición guardada se conserva. Los controles del chat sí cambian inmediatamente con el idioma de la interfaz.

Las traducciones adicionales se indexan con `textKey(...parts)`, que genera un array JSON:

- `['adventure', 'name']` y `['adventure', 'description']`.
- `['map', mapId, 'name']`.
- `['entity', mapId, entityId, 'label' | 'description' | 'interaction']`.
- `['item', itemId, 'name' | 'description']`.
- `['event', eventId, 'name']`.
- `['module', 'event', eventId, moduleId, 'title' | 'text']`.
- `['module', 'object', mapId, entityId, moduleId, 'title' | 'text']`.
- `['chat', resourceId, nodeId, 'message', groupIndex, lineIndex]`; para mensajes sin grupos se omite lineIndex.
- `['chat', resourceId, nodeId, 'option', optionIndex, targetId]`.

Cada entrada es `{source: 'Texto original', value: 'Translated text'}`. Si cambia el original, la traducción antigua deja de aplicarse. Las opciones del chat incluyen índice, destino y texto original para evitar reutilizar una traducción en una opción reordenada. La futura edición podría asignarles además IDs explícitos.

Las vistas traducidas conservan IDs, geometría, condiciones, enlaces, claves de almacenamiento y datos originales. Cambiar idioma no ejecuta eventos, reinicia módulos ni otorga puntos. Los rótulos de Pixi se actualizan sin reconstruir el mundo ni mover al personaje. Los diccionarios viajan en el JSON/ZIP y en la publicación inmutable; el catálogo público solo recibe sus títulos y descripciones publicados, no los textos de todos sus módulos.

## Formularios y compatibilidad

`translation-catalogue.ts` enumera campos por IDs y clasifica cada traducción como pendiente, traducida o desactualizada. Las traducciones nativas de módulos importados se reconocen sin duplicarlas; las que no tengan historial anterior no pueden detectar retrospectivamente cambios del original. Al editar desde el catálogo se registra el original y se comprueba en cada uso. Vaciar una traducción deja el campo pendiente y utiliza el original, incluso si existía otra traducción nativa anterior. Revisar y validar una desactualizada actualiza su referencia de origen.

Las traducciones de respuestas se aplican también al alias de validación `correct_answer` cuando existe, conservando las otras versiones. Cambiar idioma no remonta el reproductor ni cambia su clave de progreso: solo actualiza el contenido saneado y conserva los puntos y las respuestas. Los módulos con texto único conservan su original al añadir un idioma; el editor usa el idioma original de la aventura.

Las variantes de multimedia por URL y los mensajes de resultado siguen el mismo esquema. Los recursos incrustados de más de 200 KB se gestionan desde el formulario del módulo para evitar duplicar su contenido en los metadatos de traducción. Los originales y datos de juego no se modifican.

Los paquetes independientes consumen opcionalmente el contexto `Symbol.for('isometric.interface-language')`, definido por la aplicación, y continúan funcionando en español sin un host. La biblioteca de UI no importa diccionarios del proyecto. `scripts/update-ui-messages.mjs` incorpora pares revisados y regenera claves y formatos de mensajes variables sin cambiar IDs existentes.

## Evoluciones posteriores

Traducción asistida opcional, revisión editorial antes de publicar, importación/exportación de catálogos de traducción, IDs propios en opciones de chat y localización de textos remotos mediante códigos de error. No traducir IDs, reglas, respuestas guardadas ni códigos de estado.
