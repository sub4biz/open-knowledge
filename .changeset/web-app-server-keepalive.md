---
"@inkeep/open-knowledge": patch
---

Keep an open browser tab's `ok start` server alive. The web editor now holds a single, app-lifetime `/collab/keepalive` WebSocket — the same presence-invisible keepalive the desktop app and MCP shim already use — so the server's 30-minute idle-shutdown can no longer fire out from under an open tab when no document is focused or during a brief reconnect. Previously, with no doc open the only liveness signal was the per-document collab connections, so an idle tab could lose its server and every editor/tool call would fail until reload. Closing the tab still lets the server idle-shut-down normally, and the keepalive reconnects across a server restart on a new port. Multiple tabs each hold their own keepalive. The keepalive adds no presence-bar entry.
