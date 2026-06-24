---
"@inkeep/open-knowledge": patch
---

Fix the appearance theme toggle making other open project windows flicker between light and dark before settling. With more than one project open, switching `Light` / `Dark` / `System` would strobe every other window. The cause was an app-layer feedback loop: when a window observed another window's theme change, it re-applied its own briefly-stale saved theme and wrote that stale value back to the shared theme storage, which re-triggered every window until all windows caught up. Theme changes now propagate across windows cleanly, with no cross-window flicker. (A companion change separately reduces redundant macOS window-chrome translucency work on the same switch.)
