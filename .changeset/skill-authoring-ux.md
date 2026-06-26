---
"@inkeep/open-knowledge-server": patch
"@inkeep/open-knowledge-app": patch
---

Skill authoring UX fixes. Deleting a personal (Global) skill and then re-creating one with the same name now persists reliably — previously a same-name re-create that authored identical content was silently dropped because the managed-artifact last-known-good cache was not evicted on delete, so the re-create was classed a no-op and never re-landed on disk. Writing a raw `document` under `.ok/skills/…` (or `.ok/templates/…`) now returns a path-aware error pointing at the correct `skill` (or `template`) target instead of a generic rejection, and the `write` / `edit` tool descriptions and the project skill now name all five write targets so an agent reaches for `skill` instead of defaulting to a plain document. Skill scope is labeled "Global Skill" / "Project Skill" (the word "scope" is gone from the UI) with a colored level toggle.
