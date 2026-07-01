---
"@inkeep/open-knowledge-desktop": patch
---

Two docked-terminal fixes. Dropping a file onto the terminal now inserts its shell-escaped absolute path at the prompt (matching VS Code / Cursor / JetBrains), so you can drag a screenshot straight into a running `claude` session instead of the drop being ignored. And highlighting text and choosing "Ask AI" now sends the selection straight into the open terminal (or opens the Ask AI composer when no terminal is open) — consistent with the fact that there is no composer visible while the terminal is up. Launching a CLI (Create with…, Open in terminal) always opens a new terminal tab rather than reusing the one already running.
