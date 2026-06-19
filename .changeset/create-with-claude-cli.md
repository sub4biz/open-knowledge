---
"@inkeep/open-knowledge": patch
---

The empty-state create surface can now launch the `claude` CLI in a docked terminal. Alongside the existing app agents, the agent-picker dropdown now offers a **Terminal → Claude** option. Selecting it switches the primary button to **Create with Claude CLI**; clicking Create then opens the docked terminal with the same create-scope prompt built from your typed brief — bringing the new-file empty state to parity with the editor's "Open with AI" menu (desktop only; absent on the web host).

The Open-in-Agent menus ("Open/Edit with AI", the file-tree right-click submenu, and the sidebar empty-space submenu) and the empty-state agent picker are now organized into labeled **Desktop** (app launches) and **Terminal** (CLI launch) sections, so the two launch modes are visually distinct. The CLI row's visible label is now "Claude" (its accessible name remains "Claude CLI"). Section labels render only for non-empty sections, and existing launch behavior is unchanged.
