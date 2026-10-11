# Almacenamiento intercambiable y cartuchos

PostgreSQL conserva borradores, permisos, usuarios y el registro de archivos. Las imágenes siguen usando `asset:ID`; el servidor resuelve su proveedor y ruta. `ObjectBackend` tiene `get`/`put`, con adaptadores local y S3 (R2). Otro proveedor puede implementar el mismo contrato.

## Configuración privada

El valor predeterminado de `PLATFORM_STORAGE_ACTIVE` es `local`. Para R2:

```dotenv
PLATFORM_STORAGE_ACTIVE=r2
S3_STORAGE_ID=r2
S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
S3_BUCKET=pixtories
S3_REGION=auto
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

No incluir `/pixtories` en el endpoint. Las credenciales solo se leen en el servidor. Crear un token de lectura/escritura de **objetos**, restringido al bucket, y desactivar el dominio público `r2.dev`. El backend sirve las imágenes después de comprobar permisos; no hace falta CORS ni acceso público al bucket.

`npm run storage:probe` comprueba escritura y lectura con `.env`, sin imprimir secretos. Conserva un pequeño JSON en `sistema/comprobaciones/` como comprobante.

Mantener `PLATFORM_STORAGE_DIR` en un volumen persistente de Railway: contiene archivos antiguos y los trabajos de vídeo, que aún no se migran. Activar R2 no hace desaparecer la dependencia de ese volumen.

## Estructura

```text
espacios/{tenantId}/aventuras/{adventureId}/imagenes/{assetId}/{hash}.png
espacios/{tenantId}/biblioteca/{kind}/{resourceId}/{hash}.zip
compartidos/biblioteca/{kind}/{resourceId}/{hash}.zip
espacios/{tenantId}/aventuras/{adventureId}/versiones/{releaseId}/
  aventura.json
  graficos.json
  manifiesto.json
  assets/*.png
  cartucho.zip
```

Las claves usan identificadores estables. Cambiar el nombre de un espacio o aventura no mueve archivos. Un archivo reutilizado por varias aventuras conserva su ubicación de origen; cada publicación incluye su propia copia. Las imágenes antiguas sin aventura identificable se migran a `espacios/{tenantId}/biblioteca/imagenes/`.

## Publicación

Cada publicación crea una versión inmutable, copia todos los PNG del catálogo jugable (incluidos los gráficos base) y genera JSON y ZIP. Excluye originales de edición, prompts y posiciones editoriales del guion. El manifiesto incluye tamaño y SHA-256 de cada archivo. El ZIP mantiene el formato importable `isometric-adventure-package` v1 con `manifest.json` y `assets/`.

Solo se activa la nueva versión después de guardar todos sus archivos. Una subida fallida conserva la publicación anterior; puede dejar archivos sin referencia en el prefijo de la versión fallida. Por ahora no hay purga automática. Los cartuchos y versiones anteriores cuentan en `storageMB`, incluyendo el ZIP y las copias separadas.

Las imágenes publicadas se leen de la copia de la versión, con verificación de integridad. Las versiones anteriores sin cartucho conservan su comportamiento y lo generan al volver a publicar; **no se republican borradores durante la migración**.

La descarga autenticada por el estado público es `/api/public/cartridges/{releaseId}/cartucho.zip`. Solo sirve archivos declarados en el manifiesto, mientras la publicación y su espacio estén activos. El bucket nunca se expone directamente.

El cartucho incluye los gráficos del juego y su definición. Vídeos, audios, imágenes y enlaces externos de módulos continúan siendo dependencias: no se descargan URLs arbitrarias desde el servidor. Los datos multimedia embebidos en JSON se conservan. El manifiesto declara los enlaces detectados; esto aún no garantiza una experiencia totalmente offline.

## Migración

En Superadministración → **Almacenamiento de recursos**, revisar los pendientes y ejecutar **Migrar siguiente lote**. Solo un superadmin sin suplantación puede hacerlo.

También existe `GET /api/platform/storage` y `POST /api/platform/storage/migrate` con sesión de superadmin y cuerpo `{"dryRun":true}` para revisar, o `{"dryRun":false,"limit":5}` para copiar (1–20 registros). La operación conserva los originales, verifica origen y destino, cambia el registro tras verificar y registra cada cambio en auditoría. Repetir hasta pendientes cero; es reanudable y admite peticiones concurrentes sin migrar la misma fila a la vez.

Nunca borrar el volumen ni retirar una configuración de proveedor mientras queden registros que la utilicen. Ante un error remoto, no se usa un archivo local por accidente.

## Cambiar de proveedor

Cada ubicación conserva un ID de proveedor. Para cambiar de bucket/proveedor, usar un **ID nuevo**, no redefinir `r2` apuntando a otro bucket. Los proveedores anteriores S3 pueden conservarse en `PLATFORM_STORAGE_PROFILES`, una lista JSON privada:

```json
[{"id":"r2-anterior","endpoint":"https://ACCOUNT_ID.r2.cloudflarestorage.com","bucket":"bucket-anterior","region":"auto","accessKeyId":"...","secretAccessKey":"..."}]
```

Elegir el nuevo ID como activo, mantener los anteriores configurados y migrar. El adaptador local permanece disponible para archivos históricos. Cambiar a Bunny u otro API no S3 requiere un adaptador; no está implementado todavía.

## Comprobaciones

`tests/object-storage.test.ts` valida rutas, inmutabilidad, transporte S3 y compatibilidad del ZIP. `tests/platform.test.ts`, con una base aislada acabada en `_test`, verifica aislamiento de espacios, fallos de publicación, independencia de originales, migración y detección de archivos corruptos.
