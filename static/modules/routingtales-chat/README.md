# RoutingTales chat

`chat-bot.js` is vendored from RoutingTales `elgenio-2.5/public/chat-bot.js` (the source application's package declares MIT). Local patches remove Google Fonts links to avoid a network dependency and skip rendering empty option arrays (the legacy zero-height transition never finishes, preventing terminal node events). Chat buttons also receive keyboard activation and button semantics. The original branching, repeated-node messages, options and node events remain in the original module.

`index.html` and `bridge.js` isolate its custom elements and lifetime in a sandboxed iframe. Destroying the frame releases the legacy observers and animation state. The parent supplies RoutingTales JSON with `setChatConf`, resumes at the last displayed node and receives `chatbot:node_added`. No free-text endpoint, microphone, geolocation or game scoring is enabled. The host owns progress, and does not apply rewards embedded in content.

Protocol: `routingtales-chat-v1`; ready → configure {config,startNode} → configured; node {id}; error; close. Parent checks frame source and node membership. The frame intentionally has an opaque origin (allow-scripts only).

## Using a conversation

In the entity's advanced interaction properties, use action `chat.open` and resource `/chats/your-chat.json` (put the native file under `static/chats/`). Built-in aliases `lucia` and `marcos` resolve to bundled examples. Avatar paths resolve relative to the JSON file. HTML media paths inside messages should be absolute paths within the app. The example player name is Explorador.

This first integration stores only the last displayed node per adventure/map/entity/resource, not the full transcript or repeat counts. It recognizes `success` for the completed indicator; RoutingTales activity-level events, points, rewards, backend queries and free-text services are not integrated with the game. Keep these policies in the future adventure host rather than in the rendering engine.
