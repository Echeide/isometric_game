# Piskel in the sprite workshop

Pinned upstream: https://github.com/piskelapp/piskel/commit/a6b9c02daefceb10093f71e92d52d16920ccb16e

The compiled distribution is committed under `static/tools/piskel/`. Normal development,
builds and Railway deploys serve these files directly; they need no extra process or network fetch.
Only the image editor dialog loads this distribution. `bridge.js` and `embed.css` here
are the source of our adapter; generated copies live alongside the distribution.

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

Scope: one original PNG for objects, floors and the static image of an NPC. Dimensions and
transparency are preserved, layers flatten into that PNG, and image edits remain pending in
the workshop until saved. Animation timelines and authoring-project/layer persistence are
outside this first integration. Piskel's tools retain their upstream English labels.
