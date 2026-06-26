---
"@inkeep/open-knowledge-app": minor
---

Edit skills and templates as first-class editor tabs instead of separate full-screen overlays. Opening a skill or template (from the sidebar Skills section or Settings) now opens it as a normal tab through the same editor pipeline documents use — with the file sidebar, tab bar, property panel, and version history. Skills additionally carry Install / Reinstall / Uninstall + history controls in the per-document toolbar. Skill and template tabs resolve as real documents everywhere (navigation, hash round-trip, graph/links), and a doc that links to a skill/template by its `.ok/skills/<name>/SKILL` or `.ok/templates/<name>` file path now opens the artifact editor instead of offering to create a missing page.
