---
"@inkeep/open-knowledge": minor
---

The docked terminal now supports **multiple concurrent sessions as tabs**. Run an agent in one tab while you run `git`, a build, or a second shell in another — no more waiting for one session to free up or alt-tabbing to an external terminal.

- A tab strip in the dock header lists open sessions with a `+` New Terminal affordance, a per-tab close (×), and an active indicator. Each tab is its own login shell at the project root.
- Sessions are fully isolated: a flood or a crash in one tab pauses or restarts only that tab — output stays byte-exact with no cross-tab interleave, and backpressure is accounted per session.
- Tab lifecycle follows the VS Code / Zed model: closing the active tab activates a neighbor, closing the last tab collapses the dock and returns focus to the editor, and hiding the dock (⌘J) keeps every session alive (hide is not kill).
- "Open in terminal" always opens a fresh tab and runs `claude` there once — it never interrupts a tab you're already using.
- The Terminal menu's New/Kill Terminal and a ⌘-number tab-switch shortcut operate on tabs; the tab strip is keyboard- and screen-reader-navigable (tablist roles, arrow-key movement, focus-on-close).
- Each session keeps 10,000 lines of scrollback.

Under the hood, all of a window's sessions are multiplexed through one terminal host process (matching VS Code's shared-host model), so per-window memory stays flat regardless of tab count. The security posture is unchanged: terminals remain human-only and default-on, and no new IPC surface is added. Split panes and per-tab shell/cwd selection are deliberately not included yet.
