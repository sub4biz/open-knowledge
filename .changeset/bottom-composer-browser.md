---
"@inkeep/open-knowledge": patch
---

Show the "Ask AI" composer in a regular browser, not just the desktop app.
Previously the bottom composer was hidden everywhere except OK Desktop, which
was an oversight — it now appears whenever you have a document (or folder) open.
It stays hidden only when OK's preview is embedded inside a desktop coding agent
(Claude Code, Codex, Cursor), where that agent is already the AI surface. On the
web the composer degrades cleanly: no docked-terminal CLI options, and the agent
picker deep-links to your locally installed agents.

Also hardens the composer so it never grabs focus when a document opens — it
focuses only on an explicit reopen — so opening or creating a file no longer
pulls the caret out of the editor or an in-progress inline rename.

The "Ask AI" button in the text-selection toolbar now appears on every platform
too (it was macOS-only because the composer used to be), so selecting text in a
browser on any OS offers the same one-click handoff. Its Ctrl+Shift+I keyboard
shortcut stays macOS-only, since that chord is the browser DevTools shortcut on
Windows/Linux.
