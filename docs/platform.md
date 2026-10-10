# Plataforma de aventuras

La aplicación separa el catálogo público, la gestión por espacio y la superadministración. PostgreSQL conserva cuentas, sesiones, permisos, límites, aventuras, publicaciones y auditoría. Los PNG y ZIP inmutables se almacenan en PLATFORM_STORAGE_DIR. Las contraseñas usan scrypt y las cookies de sesión HttpOnly caducan a las ocho horas. El servidor comprueba el origen de las operaciones de escritura.

## Desarrollo local

1. Instalar dependencias con `npm install`.
2. Con PostgreSQL 16+ instalado, ejecutar `npm run platform:db`. Prepara un clúster aislado en `.platform-data`, sin escucha TCP, y añade DATABASE_URL a `.env` si no existe. Repetir tras reiniciar el ordenador para arrancarlo. No modifica otras instalaciones de PostgreSQL.
3. Definir PLATFORM_BOOTSTRAP_USER/PASSWORD en `.env` y ejecutar `npm run platform:bootstrap`. Para conservar la cuenta anterior del taller: `npm run platform:bootstrap -- --use-workshop-account`. Solo crea el superadmin si la tabla de usuarios está vacía. No imprime contraseñas.
4. Arrancar `npm run dev`, entrar por `/login` y crear un espacio y su administrador en `/superadmin`.
5. «Entrar como» abre la gestión de ese administrador con sus permisos y límites. La barra superior permite volver al superadmin. La auditoría distingue al actor real del efectivo.

## Migración de datos

No se importan automáticamente datos de un navegador a una cuenta. En `/admin`, «Recuperar aventuras de este navegador» muestra las copias locales y permite copiar las elegidas al espacio actual. También se puede importar un ZIP de aventura. El original local permanece intacto. Los proyectos del generador siguen admitiendo su `.project.zip`.

La antigua `.sprite-library` no se convierte en catálogo público. Exportarla a ZIP con `node scripts/export-legacy-library.mjs <directorio> <archivo.zip>` e importar ese ZIP desde «Biblioteca del espacio» de la cuenta elegida. El archivo se crea sin alterar los originales. En Railway el directorio anterior era `/data/sprite-library`.

Los trabajos de vídeo anteriores siguen en CHARACTER_VIDEO_JOBS_DIR. Para asignarlos explícitamente a un espacio existente, copiar su contenido al subdirectorio `PLATFORM_STORAGE_DIR/videos/<tenant-id>` conservando los originales. No copiar trabajos de distintos propietarios juntos. Los nuevos trabajos siempre se consultan dentro del espacio de la sesión.

## Publicaciones y bibliotecas

Guardar actualiza el borrador. Publicar crea una revisión independiente; los siguientes cambios requieren «Actualizar publicación». Retirar la publicación impide nuevas lecturas públicas. Las imágenes originales de edición y metadatos de generación no se incluyen en las hojas públicas.

El guardado de mapas y contenido reutiliza los gráficos previamente validados, sin releer los PNG. Cambiar el paquete gráfico o enviar imágenes conserva la validación completa. Se comprueban siempre las referencias del mapa, el espacio, los límites y la revisión para evitar sobrescribir cambios de otra sesión. «Guardar y jugar» precarga el código de la vista previa mientras guarda y muestra «Guardando… / Abriendo…»; si el guardado falla, conserva el editor y permite volver a intentarlo.

En **Mis aventuras**, las tarjetas distinguen **Publicada · al día**, **Cambios sin publicar** y **Borrador privado**. El filtro **Con novedades** muestra las publicaciones que difieren de su contenido guardado, y el botón **Publicar cambios** actualiza su copia pública. El estado se refresca al volver a esta pantalla o con el botón de actualización. Se compara contenido, no fechas ni contadores: guardar sin modificar nada o conservar originales privados no crea una falsa novedad. También funciona con publicaciones anteriores.

Cada recurso de biblioteca pertenece al espacio. El superadmin puede copiarlo al catálogo compartido. Retirarlo del catálogo no elimina copias incorporadas a aventuras ni el recurso original. El administrador puede descargar/exportar su biblioteca e incorporar copias independientes.

Las escrituras de aventuras usan revisiones: dos pestañas no pueden sobrescribirse silenciosamente. Ante un conflicto, exportar los cambios y volver a cargar. Los borradores de edición local se separan por usuario y espacio.

## Railway

Este cambio necesita PostgreSQL antes de desplegar. Crear un rol dedicado de aplicación **sin SUPERUSER ni BYPASSRLS** y una base propiedad de ese rol; usar su URL interna en DATABASE_URL. La aplicación rechaza roles que eludan Row Level Security. El primer arranque aplica el esquema bajo un bloqueo transaccional.

Conservar el volumen `/data`; establecer PLATFORM_STORAGE_DIR=/data/platform, ORIGIN con el dominio HTTPS y BODY_SIZE_LIMIT=200M. Mantener OPENAI_API_KEY/MAGNIFIC_API_KEY exclusivamente en el servidor. La cuenta inicial se crea ejecutando el script de bootstrap una vez desde un entorno con acceso a PostgreSQL; las variables de bootstrap se pueden retirar después.

Hacer copia de PostgreSQL y del volumen como una unidad. Los recursos tienen referencias por hash: restaurar solo uno de los dos almacenes puede dejar referencias incompletas. No borrar los directorios antiguos hasta verificar la migración. No volver a una versión antigua de la aplicación mientras escriba esta plataforma.

## Cuotas y alcance

Por espacio: número de aventuras, publicaciones activas, MB de imágenes/paquetes persistidos y solicitudes mensuales de imágenes/vídeos. Las reservas de IA y las comprobaciones de almacenamiento usan un bloqueo de fila para impedir sobrepasos concurrentes. Una solicitud fallida después de reservar cuenta como intento: no se reintenta una generación pagada automáticamente. Consultar o descargar un vídeo existente no consume otra generación.

El límite de recursos guardados incluye imágenes históricas y ZIP de biblioteca; los vídeos fuente y los proyectos locales del generador no cuentan en ese límite. Debe vigilarse también el espacio total del volumen. La retirada de contenido no purga archivos que podrían seguir usándose en publicaciones anteriores. La recuperación de contraseñas se realiza mediante el superadmin; no hay servicio de correo configurado.

## Verificación

`npm run check`, `npm test` y `npm run build`. Las pruebas de PostgreSQL requieren PLATFORM_TEST_DATABASE_URL y una base **aislada cuyo nombre termine en _test**. `npm run test:platform` limpia únicamente las tablas de esa base de pruebas y verifica aislamiento, publicaciones, permisos, cuotas concurrentes y suplantación auditada. El rol de pruebas también debe carecer de SUPERUSER/BYPASSRLS.

## Condiciones y progreso de la historia

La pestaña **Condiciones** del inspector configura estados con nombre, un estado
inicial, requisitos de visibilidad/interacción y reacciones. Los estados pueden
cambiar el gráfico (compatible con el tipo del objeto), su descripción, el bloqueo
del paso y la disponibilidad. Un objeto oculto desaparece también de navegación;
un objeto visible con interacción bloqueada conserva sus colisiones y explica el
requisito mediante un mensaje configurable.

Cada estado muestra una miniatura del gráfico elegido. **Preparar abierto/cerrado**
añade ambos estados y dos reacciones repetibles a un objeto sin estados ni
reacciones; no sustituye reglas existentes, módulos, salidas ni recogidas de
inventario. Conserva la interacción activa; si falta o solo muestra información,
añade `story.interact`, que ejecuta las consecuencias sin abrir un panel de contenido.
Ambos estados heredan el gráfico y las propiedades actuales hasta que el autor
los cambie. Para evitar saltos, los gráficos deben tener tamaño y apoyo coherentes.

El taller agrupa objetos en **familias de gráficos**, con aspectos nombrados como
«Cerrado», «Abierto» o «Roto». En cada estado, el selector elige automáticamente la
familia del gráfico actual y muestra sus aspectos con miniaturas; también permite
buscar otra familia o consultar todos los objetos. Un gráfico personalizado puede
representar un estado de un objeto del catálogo base sin cambiar su tipo, identidad,
posición, huella o interacción. Los gráficos de PNJ siguen separados de los objetos.
La familia organiza el taller; no cambia estados por sí misma ni se necesita en la
partida publicada, que conserva el identificador concreto de cada aspecto.

Las reglas combinan «todas»/«alguna», con negación por requisito, y consultan estados
de objetos, progreso de módulos (`not-started`, `started`, `completed`, `failed`) o
cantidades de inventario, incluyendo referencias a otros mapas. Las referencias a
objetos, módulos, estados y artículos se validan al guardar/importar. No se puede
eliminar un recurso aún utilizado por una regla. La identidad del módulo es local
al objeto, independiente de su contenido; por ahora el adaptador disponible es
Conversación (`chat`).

Una interacción ejecutada, un inicio o un resultado de módulo dispara sus
reacciones en el orden configurado. Sus condiciones se evalúan sobre el progreso
y el inventario al recibir el evento, antes de sus consecuencias. Así, un clic
puede abrir un cofre y el siguiente cerrarlo sin ejecutar ambos cambios a la vez.
Estas pueden cambiar estados y dar/consumir
artículos. Se aplica todo el evento conjuntamente; si una consecuencia falla, no
se conserva ninguno de sus cambios. Cambiar un estado reevalúa los requisitos,
pero no dispara nuevas reacciones implícitas. Las marcas «una sola vez» persisten
por mapa, objeto y reacción. No se ejecutan consecuencias al seleccionar el objeto,
al cancelar un panel o al fallar un requisito.

La definición se almacena en `Adventure.story` y viaja en el ZIP y en la publicación
inmutable. El progreso del jugador permanece separado, en el almacenamiento del
navegador con el ámbito ya existente de espacio/vista previa o publicación; no
sincroniza partidas entre dispositivos. Las aventuras sin `story` mantienen su
comportamiento. Las conversaciones anteriores aportan su estado guardado sin
reproducir recompensas antiguas.

El panel **Pruebas de aventura** permite simular estados de objetos y módulos,
consultar requisitos y reacciones ejecutadas, y modificar el inventario de prueba.
La ejecución de consecuencias al simular un módulo está desactivada por defecto.
La simulación de progreso no edita los nodos del chat ni el estado inicial de la
aventura. Reiniciar borra conjuntamente progreso, inventario, conversaciones y
marcas de reacciones; conserva los mapas y gráficos. Los cambios físicos del
escenario conservan la posición y cámara del jugador; si su casilla queda ocupada,
se usa una casilla libre cercana. Un estado sin casillas libres se rechaza.

Las publicaciones incluyen los eventos narrativos y sus módulos de contexto o conversación. La distribución de tarjetas `story.layout` se conserva en los borradores y ZIP, se omite en las versiones públicas y no se considera una novedad publicable. Un guion con solo posiciones, sin reglas ni eventos, equivale a no tener configuración narrativa.
