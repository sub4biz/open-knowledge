---
"@inkeep/open-knowledge-app": patch
---

The "Ask AI" composer's terminal CLI rows now use the same labels as the empty-state Create composer: the bare brand name as the visible label ("Claude", "Codex", "Cursor", "OpenCode") with "<name> CLI" as the accessible name, instead of a visible "(CLI)" suffix. Combined with the brand icons, the two agent pickers now render identical Terminal sections. The accessible name still distinguishes a Terminal row from a same-named Desktop row (and now satisfies WCAG 2.5.3, since the accessible name contains the visible label).
