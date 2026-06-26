---
"@inkeep/open-knowledge-server": patch
"@inkeep/open-knowledge": patch
---

Render skill reference graph nodes as resolved, and address review follow-ups.

- A skill-bundle reference node in the link graph now renders as a normal resolved node instead of the dashed-red "missing" treatment. The node always resolved to a real, openable read-only viewer (clicking it works), but it was misclassified as a missing link target, so it read as broken.
- A failed skill move no longer turns into a 500 when the post-rename graph re-index throws — the rename already succeeded, so a re-index failure is logged and swallowed.
- The skills-list handler now logs when `readdirSync` fails instead of silently returning an empty list, and the bundle-file path classifier rejects NUL bytes for parity with its sibling validators.
- The starter-pack update dialog and toasts show the skill's display name instead of its raw internal id, and the skill menu's update action reads as an imperative ("Update skill").
