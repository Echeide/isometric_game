# Piskel in the sprite workshop

Pinned upstream: https://github.com/piskelapp/piskel/commit/a6b9c02daefceb10093f71e92d52d16920ccb16e

The compiled distribution is committed under `static/tools/piskel/`. Normal development,
builds and Railway deploys serve these files directly; they need no extra process or network fetch.
Only the image editor dialog loads this distribution. `bridge.js` and `embed.css` here
and `palette.js` are the source of our adapter; generated copies live alongside the distribution.

To rebuild (Node compatible with upstream Vite 8):

```sh
git clone https://github.com/piskelapp/piskel.git /tmp/piskel
git -C /tmp/piskel checkout a6b9c02daefceb10093f71e92d52d16920ccb16e
cd /tmp/piskel
npm ci --ignore-scripts --no-audit --no-fund
npm run build
cd /path/to/Isometrico
node scripts/vendor-piskel.mjs /tmp/piskel
```

The vendor script verifies the revision, copies the compiled assets and license notices,
and patches boot to disable independent backups, saving and file drops. It adds a local
CSP and the adapter. Review upstream changes before updating the pinned revision.

Protocol: `isometrico-piskel-v1`, same-origin messages, exact iframe source and a per-open
session ID. Parent sends `open` (PNG Blob, name, dimensions) after `ready`. Child responds
`loaded`, `dirty`, `error`; `apply` returns `result` (PNG Blob, changed). Ctrl/Cmd+S emits
`apply-request`. Parent revalidates PNG size/dimensions before accepting a result.

Scope: static PNGs or a selected animation/direction strip. Dimensions and transparency are
preserved. Layers flatten only on export; edits remain pending in the workshop until saved.
Palette controls are injected below the native Palettes panel. `open.palette` initializes a
session-only palette store (never a cross-tenant localStorage palette list). The selected native
palette drives OKLab matching on every frame/layer, with an atomic history snapshot. Undo/Redo
also determines `result.paletteApplied`; the host recolors the other resource sheets only when
an adaptation remains active. Palette selection/loading does not recolor pixels. Palette changes
never change the shared adventure palette. `palette-start/progress/done` report busy state.
A single layer at opacity 1 also returns straight RGBA; the host validates and encodes it without canvas premultiplication rounding translucent palette RGB. Multi-layer export uses Piskel’s normal flattening.
Native tools retain their upstream English labels; our controls use Spanish.

### Ciclos del generador

El mensaje `open` admite `frames` y `fps` opcionales. El PNG recibido contiene una fila con celdas iguales. En modo ciclo, la integración permite navegar y previsualizar los fotogramas; `apply` conserva cantidad, orden y dimensiones y devuelve una única fila PNG con las capas combinadas. Los mensajes que omiten esos campos conservan el comportamiento de una imagen. El FPS de Piskel controla solo la vista previa.

El padre valida la respuesta `loaded` (`frames`, ancho de celda y alto) antes de permitir editar o aplicar. Una versión antigua que abra toda la tira como una imagen se rechaza. La URL del iframe y las de `bridge.js`/`embed.css` llevan la revisión `frames-2`; al cambiar el protocolo o sus recursos, mantenerla sincronizada con `editorRevision` y el script de vendorización.
