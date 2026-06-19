---
"@inkeep/open-knowledge": patch
---

Add an instruction prompt box to the toolbar "Open with AI" menu. The menu is now a popover with a "What should the AI do? (optional)" field above the installed-agent list; the typed instruction rides along into the launched agent's first-turn prompt (both the deep-link dispatch and the docked-terminal "Claude CLI" launch), mirroring the editor's "Edit with AI" affordance. Leaving the box empty preserves the previous one-click behavior.
