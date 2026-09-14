# @isometrico/world

Componente isométrico para Svelte 5 con PixiJS 8. El anfitrión aporta un `WorldAdapter` con el escenario y la función `interact`. El paquete gestiona mapa, colisiones, rutas, movimiento y cámara; no conoce Prisma ni los datos de negocio.

```svelte
<script>
  import { World } from '@isometrico/world';
  let { adapter, graphics, working = false } = $props();
</script>
<div style="position:relative;height:600px">
  <World {adapter} {graphics} {working} />
</div>
```

Exports: `World`, contratos TypeScript (`WorldScene`, `WorldEntity`, `WorldAdapter`, `WorldInteraction`, `WorldController`, `Cell`, `EntityKind`) y funciones de navegación (`findPath`, `walkable`, `interactionCells`, `project`).

El mapa requiere casillas enteras, aparición libre y un contenedor con altura. Cambiar geometría requiere remontar el componente mediante `{#key scene.id}`; `working` es reactivo. Proporciona accesos HTML equivalentes para las personas que no usen el canvas. Los efectos de una interacción y su autorización/persistencia pertenecen siempre al servidor de la aplicación anfitriona.

Versión inicial: gráficos provisionales, un avatar local, sin transporte multijugador. Consulta el README del repositorio para el ejemplo completo de integración SvelteKit y Prisma.

Pasa `graphics: PixelArtPack` a `World` para cargar tus PNG/atlas, con celdas, anclaje y animaciones por dirección. Las rutas del catálogo deben ser accesibles desde el proyecto anfitrión; el paquete no incluye los PNG de la demo. El editor combina los gráficos `pixel.*` con entradas propias `custom.*`. Los mapas antiguos con IDs `builtin.*` o sin ID visual se convierten al equivalente en píxel al validarlos. El renderizado requiere el catálogo completo; no existe un modo clásico alternativo.

El taller de la demo gestiona el catálogo por aventura con `AdventureRepository`. Los metadatos son portables: `Adventure.catalog` añade entradas `VisualAsset` con nombre, categoría y huella; cada instancia usa `kind: 'object'` o `kind: 'person'` y su `visualId`. El host debe validar que las referencias existen antes de montar el mundo; `parseScene` valida su sintaxis y geometría.

`resolveVisualCatalog(custom, overrides)` permite personalizar nombre y categoría de las entradas base por aventura. `validateCatalogOverrides` valida las claves `pixel.*` conocidas y los campos `label`/`category`. La demo persiste estos valores en `Adventure.catalogOverrides`, los incluye en el ZIP y usa el catálogo resuelto para el taller y el editor. Al colocar una instancia se copia su nombre de catálogo; los nombres ya asignados a otras instancias se conservan.

`ObjectSprite` conserva imagen original, recorte `frame`, dimensiones de dibujo y `origin` en unidades del mundo. Para PNJ añade `animations.idle` y/o `animations.talk`, cada una con imagen, tamaño de celda, fila, fotogramas y FPS. Sin animación se usa la imagen estática; al conversar se elige `talk`, después `idle`, después la imagen estática. Los PNJ no necesitan cuatro direcciones. Un objeto gráfico asignado a un PNJ del catálogo base sustituye su dibujo; los que no tienen sustitución conservan el personaje original.

`PixelArtPack.players` guarda variantes jugables y `activePlayer` selecciona una para el avatar local. `CharacterPack.scale` cambia el tamaño común de las seis acciones. El jugador sigue necesitando las cuatro direcciones; los PNJ originales conservan sus paletas. `tileFrames` define el recorte de cada suelo, dibujado sobre baldosas de 64 × 32. Son extensiones opcionales del formato 1: el lector actual acepta los paquetes anteriores; lectores antiguos necesitan actualizarse para admitir estos recursos.

`validateGraphics(pack, sizes)` comprueba el catálogo usando un mapa de URL a dimensiones de imagen. La aplicación anfitriona resuelve sus URLs y persiste originales/metadatos; el motor solo recibe `PixelArtPack`. El guardado local de borradores pertenece al taller de demostración.

`TileKind` admite los nueve `BuiltinTileKind` y claves `CustomTileKind` (`custom.*`). `PixelArtPack.tiles` incluye los PNG de suelos propios; `tileNames` les asigna nombre y `tileFrames` permite extraer una baldosa de una hoja. El editor obtiene su paleta del catálogo resuelto. `validateSceneTiles(scene, graphics.tiles)` comprueba que cada suelo pintado existe; el renderizador y la importación/exportación de la demo realizan esa comprobación. Los suelos base siguen siendo necesarios para los entornos predeterminados. Los tipos nuevos no cambian colisiones ni navegación: cada suelo ocupa la misma baldosa isométrica de 64 × 32.

`oncamera` recibe el estado efectivo tras botones, rueda, gesto de pinza y cambios de tamaño. Su campo `action` vale `player` cuando la vista general permite acercarse al personaje y `fit` cuando el mapa está recortado y conviene encajarlo. El anfitrión puede usarlo para mostrar un único control contextual.
