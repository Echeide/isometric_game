# RoutingTales chat

`chat-bot.js` is vendored from RoutingTales `elgenio-2.5/public/chat-bot.js` (the source application's package declares MIT). Local patches remove Google Fonts links to avoid a network dependency and skip rendering empty option arrays (the legacy zero-height transition never finishes, preventing terminal node events). Chat buttons also receive keyboard activation and button semantics. The original branching, repeated-node messages, options and node events remain in the original module.

`index.html` and `bridge.js` isolate its custom elements and lifetime in a sandboxed iframe. Destroying the frame releases the legacy observers and animation state. The parent supplies RoutingTales JSON with `setChatConf`, resumes at the last displayed node and receives `chatbot:node_added`. No free-text endpoint, microphone, geolocation or game scoring is enabled. The host owns progress, and does not apply rewards embedded in content.

Protocol: `routingtales-chat-v1`; ready → configure {config,startNode} → configured; node {id}; error; close. Parent checks frame source and node membership. The frame intentionally has an opaque origin (allow-scripts only).

## Using a conversation

In the entity's advanced interaction properties, use action `chat.open` and resource `/chats/your-chat.json` (put the native file under `static/chats/`). Built-in aliases `lucia` and `marcos` resolve to bundled examples. Avatar paths resolve relative to the JSON file. HTML media paths inside messages should be absolute paths within the app. The example player name is Explorador.

This first integration stores only the last displayed node per adventure/map/entity/resource, not the full transcript or repeat counts. It recognizes `success` for the completed indicator; RoutingTales activity-level events, points, rewards, backend queries and free-text services are not integrated with the game. Keep these policies in the future adventure host rather than in the rendering engine.

## Local conversation editor

The map editor now has a right drawer with **Propiedades** and **Módulos**.
Select an object or NPC, open Módulos, and create, assign or edit a conversation.
`src/lib/chat/ChatEditor.svelte` is a local Svelte adaptation of the visual/JSON
editor in RoutingTales `nuevo_editor/editor_Chats.html`. Node editing, answer
selectors, message groups, success/fail nodes and JSON import/export retain the
native format; this copy evolves independently. Its project selectors and
Python file-write API are replaced by the adventure repository.

An adventure optionally contains `chats: [{id, name, config}]`. The world
interaction remains `chat.open`, with resource `chat:<id>`. Existing aliases and
local JSON paths remain supported. Editing a legacy JSON creates an embedded
copy in this adventure; it does not overwrite the original static file.
Applying changes updates the map editor draft and is undoable. Save the adventure
to persist it, and update its publication separately to expose the new content.
The same embedded chat may be assigned to multiple entities in this adventure;
the editor shows their count. Chats travel in adventure JSON/ZIP and published
snapshots under the existing tenant permissions. Limits: 128 chats per adventure,
256 nodes per chat, 64 answers per node and 2 MB total chat JSON.

Renaming a node updates incoming answer targets. Deletion is blocked while
another node still references it. Unknown config/node/answer fields are retained,
as are alternate message groups for subsequent visits. Flat message arrays mean
one visit with multiple messages. The JSON tab edits advanced properties without
flattening them. The embedded preview uses disposable progress and does not
change the player's saved progress. Editing opens a second layer that fills the right drawer, covering and disabling
its object form until the edit finishes. The shared `ModuleEditorHeader` places
the module title on the left and an icon-only close control on the right. Close
uses the same cancellation handler as the fixed footer and Escape; pending edits ask whether to
continue editing or discard within the same panel. Applying returns to the same
entity and restores focus to its edit control. Switching elements still warns
about unapplied edits.

Avatar and HTML image references must be accessible in the destination app;
importing JSON does not copy RoutingTales media directories. Data URLs may be
included within the JSON size limit. Points and penalties remain metadata and
are not credited to this game's economy.

The visual editor displays independent collapsible node cards instead of a node
selector. Each card provides add-after, move up/down and delete controls; the
list also has add-node, success/fail and expand/collapse-all buttons. Several
cards can stay expanded. Reordering preserves IDs, branches, message groups and
extra properties, while the first card remains the conversation entry node.

The element's Módulos tab uses the shared `EntityModules` list: choose a supported
module type, add it, and edit or remove its card. It follows RoutingTales' one
module per type model. Conversation is currently the available type; already
added types cannot be added twice. Removal clears the element's interaction in
the map draft and is undoable, without deleting shared chat content or static
JSON. The supported-type registry is separate from the list component so future
module editors can use the same interface once their runtime is implemented.
