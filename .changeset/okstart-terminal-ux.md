---
"@inkeep/open-knowledge": minor
---

`ok start` now has a clean, legible terminal. Diagnostic `INFO` logs are routed to the on-disk log file (still captured for bug reports) instead of flooding stdout, so the startup banner — Editor + API URLs plus a "Next steps" hint — is front and center. The skill/MCP/launch-json reclaim sweeps no longer print routine JSON to the terminal (only genuine failures surface), and invalid frontmatter `tags` entries (e.g. comma-joined Obsidian-style values) are dropped silently instead of warning once per file. To restore the full log stream, set `LOG_LEVEL=info` or pass `--log-level <level>` (which now takes effect — previously it was parsed but ignored).

Two reliability fixes ride along: the HEAD watcher falls back to chokidar when `@parcel/watcher` is unavailable (packaged builds ship without the native addon), so git branch-switch detection keeps working instead of silently degrading; and pressing Ctrl+C now prints an immediate "stopping…" notice explaining that pending changes are being saved and the server lock released.
