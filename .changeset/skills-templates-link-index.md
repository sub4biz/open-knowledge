---
"@inkeep/open-knowledge-app": minor
---

Skills and templates now participate in the link / backlink / graph index like documents, while staying hidden from the file tree. A document that links to a skill or template by its `.ok/skills/<name>/SKILL` or `<folder>/.ok/templates/<name>` file path resolves to the artifact identity, so the link connects to the skill/template entity (backlinks both directions) instead of a dangling file path. Editing a skill or template re-derives its own outgoing links. The file-tree exclusion is unchanged — they remain hidden from the tree.
