---
"@inkeep/open-knowledge": patch
---

`ok start` stays responsive while indexing large content directories. The boot-time index scans (backlink graph, tags, asset basenames, and the file-watcher's seed walk) previously used synchronous recursive directory reads, so on a vault with thousands of files the server's event loop was blocked for several seconds — Ctrl+C produced no feedback and editor/API connections couldn't be served until indexing finished. The walks now use async filesystem calls that yield to the event loop, so shutdown signals and incoming connections are handled while indexing proceeds. The same fix shortens the window where the desktop app's editor is slow to connect on large projects, since the desktop spawns the same server boot path.
