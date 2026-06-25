---
"@inkeep/open-knowledge-app": patch
---

The integrated terminal now opens at about one third of the window height on first use, instead of a fixed 240px that was often too short to read a command's output without dragging the divider. The default is computed as a fraction of the window height (so it scales with window size) and still respects the existing 120px floor and 50vh ceiling. A height you set by dragging is remembered as before.
