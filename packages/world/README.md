# @isometrico/world

Componente isométrico para Svelte 5 con PixiJS 8. El anfitrión aporta un `WorldAdapter` con el escenario y la función `interact`. El paquete gestiona mapa, colisiones, rutas, movimiento y cámara; no conoce Prisma ni los datos de negocio.

```svelte
<script>
  import { World } from '@isometrico/world';
  let { adapter, working = false } = $props();
</script>
<div style="position:relative;height:600px">
  <World {adapter} {working} />
</div>
```

Exports: `World`, contratos TypeScript (`WorldScene`, `WorldEntity`, `WorldAdapter`, `WorldInteraction`, `WorldController`, `Cell`, `EntityKind`) y funciones de navegación (`findPath`, `walkable`, `interactionCells`, `project`).

El mapa requiere casillas enteras, aparición libre y un contenedor con altura. Cambiar geometría requiere remontar el componente mediante `{#key scene.id}`; `working` es reactivo. Proporciona accesos HTML equivalentes para las personas que no usen el canvas. Los efectos de una interacción y su autorización/persistencia pertenecen siempre al servidor de la aplicación anfitriona.

Versión inicial: gráficos provisionales, un avatar local, sin transporte multijugador. Consulta el README del repositorio para el ejemplo completo de integración SvelteKit y Prisma.

Pasa opcionalmente `graphics: PixelArtPack` a `World` para cargar tus PNG/atlas, con celdas, anclaje y animaciones por dirección. Las rutas del catálogo deben ser accesibles desde el proyecto anfitrión; el paquete no incluye los PNG de la demo. El editor admite IDs `pixel.desk`, `pixel.tree` y `pixel.person`, además de `builtin.*`.
