---
"@inkeep/open-knowledge": patch
---

Fix Open Knowledge on Windows. Filesystem paths are now compared and normalized in a separator-correct way, so creating a new file or folder no longer fails with "path must not escape content directory" or silently vanishes from the tree, and the file tree, backlinks, tags, and sync no longer break on backslash-separated paths. `ok init` also installs the agent skill reliably now that the `npx` subprocess is spawned through a shell on Windows (where `npx` resolves to `npx.cmd`).
