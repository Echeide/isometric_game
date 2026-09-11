# Isométrico

Primera versión de un módulo de mundo isométrico para Svelte 5 / SvelteKit, con una demo de Checkpoint y RoutingTales. Renderizado 2D con PixiJS 8, TypeScript y navegación por cuadrícula.

## Arrancar

Requiere Node 22.12+ (o una versión compatible con Vite 7) y npm.

```sh
npm install
npm run dev
```

Abre la URL que muestra Vite. `npm run check`, `npm test` y `npm run build` verifican tipos, rutas alrededor de obstáculos y compilación. `npm run package:world` genera la biblioteca instalable.

## Qué incluye

- Escenario a todo el cuerpo de la ventana, con selector de mundo en la cabecera.
- Oficina con escritorios, compañeros y panel de proyecto.
- Ventanas modales al interactuar: tareas, chat, proyecto, objetivos y progreso. La mesa de encuentro y el punto de información dan acceso al resumen del mundo.
- Segundo mundo con objetivos que se pueden completar.
- Movimiento por clic, flechas o WASD, obstáculos con tamaño, ruta más corta y orden de profundidad.
- Clic en un objeto: caminar hasta una casilla adyacente y abrir la interacción al llegar.
- Zoom, centrar, ajuste al contenedor y reducción de movimiento según las preferencias del dispositivo.
- Paneles Svelte para iniciar, pausar y completar tareas; chat de demostración; objetivos.
- Accesos directos equivalentes para no depender del canvas ni del movimiento.
- Un único estado de tarea activa. Trabajar es una acción explícita: no se deduce de la posición.

Los personajes son de ejemplo. El chat no envía mensajes a terceros ni inventa respuestas. Todos los cambios se mantienen **solo en memoria durante la sesión**; se pierden al recargar. No hay autenticación, Prisma, presencia compartida ni servidor de chat conectado. No se ha publicado ningún servicio.

## Estructura

```text
packages/world/src/    Componente World, motor PixiJS, navegación y contratos
src/lib/demo/          Escenarios y adaptador de ejemplo
src/routes/           Aplicación SvelteKit de demostración
src/app.css            Diseño de la aplicación anfitriona
tests/                 Pruebas de navegación
```

El paquete no importa los componentes de la demo, modelos Prisma ni servicios de negocio. Los dos mundos usan el mismo motor.

## Usarlo en otro proyecto

```sh
npm run package:world
npm pack --workspace @isometrico/world
```

Instala el `.tgz` generado desde Passport, Checkpoint u otro proyecto con Svelte 5. El adaptador de alias del proyecto demo apunta al código fuente para permitir desarrollo en caliente; los consumidores utilizan `dist` y sus declaraciones TypeScript.

```svelte
<script lang="ts">
  import { World, type WorldAdapter } from '@isometrico/world';
  import { officeScene } from './office-scene';
  import { openTaskPanel, openConversation } from './panels';

  const adapter: WorldAdapter = {
    scene: officeScene,
    async interact(event) {
      if (event.action === 'tasks.open') openTaskPanel(event.resourceId);
      if (event.action === 'chat.open') openConversation(event.resourceId);
    }
  };
</script>

<div class="world-container">
  <World {adapter} working={false} />
</div>

<style>
  .world-container { position: relative; height: 600px; }
</style>
```

`officeScene` y los manejadores anteriores los aporta el proyecto anfitrión; no son exports del paquete. Consulta `src/lib/demo/scenes.ts` para un escenario completo.

### Contrato

- `WorldScene`: identidad, dimensiones enteras de la cuadrícula, aparición del avatar, obstáculos y entidades. La casilla de aparición debe estar libre. Las posiciones son de cuadrícula, no píxeles.
- `WorldEntity`: identidad, posición, tamaño y aspecto; interacción opcional con `action` y `resourceId`.
- `WorldAdapter.interact`: resuelve el evento en el anfitrión. El motor no modifica entidades de negocio.
- `World`: `adapter`, `working`, `onready(controller)` y `onstatus(message)`.
- `WorldController`: `goTo(entityId)`, `zoom(delta)` y `recenter()`.

Monta un `World` nuevo al cambiar la geometría/escenario (por ejemplo, `{#key scene.id}`). En esta demo los hitos completados del mundo exterior también remontan el mapa para actualizar las banderas, por lo que el avatar vuelve al inicio. `working` se actualiza sin remontar. La cámara tiene ajuste y zoom, no desplazamiento manual. El motor admite un catálogo gráfico opcional mediante la prop `graphics`; la demo ya usa PNG para personajes, escritorios, árboles y suelo. WASD/flechas corresponden a los ejes de la cuadrícula isométrica.

## Conectar SvelteKit y Prisma

1. Cargar el escenario y referencias de recursos autorizados en `+page.server.ts`. El servidor obtiene el usuario de la sesión, nunca de un identificador que afirme el navegador.
2. Convertir los modelos del proyecto a `WorldScene`/`WorldEntity`. No exponer campos sensibles en el mapa.
3. El adaptador abre los paneles existentes. Iniciar tareas, escribir mensajes o completar objetivos pasa por las acciones/endpoints ya autorizados del proyecto.
4. En cada mutación, volver a comprobar sesión, pertenencia al espacio, permisos sobre el recurso y transición válida. La comprobación del adaptador demo solo detecta errores de enrutado; **no es una medida de autorización**.
5. Mantener Prisma exclusivamente en módulos de servidor. Persistir tareas y mensajes en sus modelos actuales. Si se necesita personalización, añadir modelos propios de avatar/mapa con referencias al usuario y espacio del anfitrión.
6. Para presencia multijugador, añadir un transporte con salas autorizadas por espacio, expiración de presencia, reconexión y validación de posiciones. No almacenar cada fotograma en Prisma.

Antes de integrar de verdad hacen falta el repositorio del proyecto elegido, sus modelos Prisma, su autenticación y los componentes o endpoints de tareas/chat. El módulo actual permite evaluar la experiencia y acordar esos puntos sin crear modelos duplicados.

## Gráficos y escenarios — segunda entrega

Los mapas fuente están en `src/lib/demo/maps/checkpoint.json` y `routingtales.json`, con `schemaVersion: 1`. `parseScene` valida el documento antes de usarlo: dimensiones limitadas, tipos/recurso visual, posiciones, solapamientos sólidos, entrada libre y acceso a interacciones/asientos. `solid: false` permite decoración transitable. Un objeto puede declarar `interactionPoints` y `seat: { cell, facing }`; los puntos usan coordenadas absolutas de cuadrícula. Mover un escritorio con flechas o arrastre traslada también el asiento y sus puntos de interacción; editar sus coordenadas manualmente permite ajustar cada parte por separado.

`actor.ts` contiene un personaje articulado de gráficos PixiJS: orientación NE/SE/SW/NW, balanceo al caminar, reposo, transición de postura al sentarse/levantarse, manos trabajando, gesto de conversación y celebración. Es el renderizador procedural de respaldo cuando no se pasa `graphics`. La demo utiliza ahora el atlas pixel art y conserva la misma interfaz de animación. `facingFor` traduce el vector de desplazamiento a orientación; el motor mantiene por separado la posición, la orientación y la tarea activa. La reducción de movimiento desactiva los ciclos decorativos.

Al iniciar una tarea el anfitrión cierra el panel, y `working=true` conduce al avatar al primer puesto con asiento. Al llegar se sienta; al moverse se levanta, conservando la tarea. Para volver a sentarse, interactúa con su escritorio. Al pausar, se levanta. `celebration` es un contador reactivo del componente: incrementarlo reproduce una celebración de 1,5 segundos. `controller.setConversation(entityId | null)` orienta al personaje y activa gestos; el anfitrión debe finalizarla al cerrar el chat. Los accesos directos al chat orientan al avatar desde su posición actual; la interacción física camina primero hasta el compañero.

El catálogo `visualCatalog` incluye IDs `builtin.*` y `pixel.*`. `pixelart.ts` carga PNG y recorta los fotogramas definidos en el catálogo de gráficos. Para sustituir el arte, la interfaz de actualización del actor es `update(time, dt, pose, facing, reducedMotion)`, independiente de la navegación.

### Editor inicial

Abre `/editor` o el enlace **Editar mapa** en la cabecera. Selecciona objetos, cambia posición y dimensiones, añade/elimina elementos, define interacciones y asientos, configura la entrada y prueba el mapa. El editor guarda hasta 30 pasos de deshacer en memoria. Los cambios válidos se reflejan automáticamente en la vista, incluidos añadir, eliminar y deshacer. Los objetos nuevos buscan una posición libre que mantenga accesibles las interacciones. **Probar mapa** permite recorrer la vista validada; se mantiene la última vista válida si hay un error. Los errores muestran qué hay que corregir. Las interacciones del editor muestran su acción/recurso para comprobar la configuración, sin ejecutar acciones de negocio.

Importación y exportación usan el JSON nativo versionado. El editor trabaja en memoria: exportar descarga el archivo; volver al mundo no reemplaza los mapas del proyecto. Para incorporar un mapa exportado, sustituye el JSON fuente correspondiente y conserva los IDs/acciones utilizados por el adaptador. No se han implementado todavía pintura de tiles, rotación gráfica de muebles, importación Tiled, publicación de versiones ni persistencia en Prisma. Esta entrega proporciona el formato y las reglas sobre las que construir esas herramientas.

### Selección y colocación directa

La selección de la lista se resalta en el escenario; pulsar un objeto del escenario lo selecciona en el inspector. En modo edición se puede mover con las flechas de la cuadrícula o arrastrar con ratón, lápiz o dedo. El arrastre muestra el objeto ajustado a casillas y se confirma al soltar, en un único paso de deshacer. Las posiciones inválidas se rechazan sin modificar el mapa. Las flechas no intervienen al editar un campo o selector. **Probar mapa** activa el movimiento del avatar; **Editar mapa** devuelve el control a los objetos.

El componente compartido acepta `editor?: WorldEditor` con `selectedId`, `onselect(id)` y `onmove(id, position): boolean`. El anfitrión valida/aplica la colocación y entrega el escenario actualizado. La entrada táctil usa Pointer Events y captura del puntero; el canvas desactiva los gestos de scroll únicamente mientras se edita.

## Pixel art

Abre `/sprites` para previsualizar animaciones y descargar hojas y plantillas. Consulta [la guía de recursos](static/pixelart/README.md). El paquete exporta `PixelArtPack`; pasa el catálogo con `<World {adapter} {graphics} />`. Copia también `static/pixelart` al proyecto consumidor: los PNG de la demo no se incluyen en el paquete del motor.

## Jugar los mapas editados

En `/editor`, **Guardar y jugar** valida y guarda el mapa en localStorage y abre el mundo con sus interacciones reales. **Volver al mundo** también guarda antes de salir. Al volver al editor se recupera la versión guardada; al cambiar de escenario en el editor se guarda primero el actual. Oficina y ruta tienen espacios de guardado separados. Un mapa inválido o un fallo de almacenamiento impide salir mediante esas acciones para evitar fingir un guardado correcto.

Este guardado es local al navegador y al origen (host/puerto); no sincroniza dispositivos ni escribe en Prisma. Exportar JSON sigue siendo la forma de conservar una copia portable. Los cambios pendientes que no se hayan guardado no sobreviven a una recarga del editor.
