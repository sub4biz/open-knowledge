---
"@inkeep/open-knowledge-server": patch
"@inkeep/open-knowledge": patch
---

Fix skill move/scope-change losing bundle files and dropping references from the link graph. A cross-scope skill move (global ↔ project) copied only `SKILL.md` and then deleted the source, silently losing every `references/**` and `scripts/**` file; both the MCP `move` verb and the editor's scope switch now copy the full bundle through the per-type write path (project `.md` references rejoin the backlink/tag graph; global references and all scripts are written fs-direct) before deleting the source, aborting without data loss on any partial-copy failure. A same-scope skill rename now re-indexes the relocated `SKILL.md` and its `.md` references into the live backlink/tag graph (previously they sat unindexed until a manual rescan). The editor also reconciles open skill tabs after a server-side move — a tab whose skill moved scopes retargets to the new location, and one whose skill was deleted closes — so no stale phantom tab is left behind. Also adds the new skill write routes to the mutating-route CSRF guard and the conflict gate.
