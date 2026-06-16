---
"@inkeep/open-knowledge": patch
---

Bring back the instruction prompt box on the editor's "Edit with AI" affordance. Selecting text and clicking "Edit with AI" (or pressing Cmd+Shift+I) now opens a popover with a "What should the AI do?" field above the installed-agent list, instead of jumping straight to an agent picker. Type an instruction and pick an agent to hand off the selected passage with your instruction attached; the field is optional, so you can still dispatch with no instruction. The passage is snapshotted when the popover opens, so changing your selection afterward does not alter what gets sent.
