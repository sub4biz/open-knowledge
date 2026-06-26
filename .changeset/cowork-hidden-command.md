---
"@inkeep/open-knowledge": patch
---

Rename the `ok install-skill` CLI command to a deliberately hidden, unadvertised `ok cowork`. The old name implied an automatic install it never performed — it builds the `openknowledge.skill` bundle and opens the Claude Desktop App for a manual upload (the only path to the separate Skills list Claude Chat & Cowork read, which `ok init`'s editor wiring can't reach). The command is now registered hidden (absent from `ok --help`), and `ok init` no longer pushes a hint toward it — it is a power-user escape hatch discovered pull-only via the Open Knowledge skill. The underlying bundle build and the `POST /api/install-skill` route are unchanged.
