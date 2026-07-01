---
"@inkeep/open-knowledge": patch
---

`exec` reads now surface more of what OpenKnowledge already tracks, in the human-readable listing an agent reads. `ls` shows a folder's available templates (name, description, scope), its description and tags, and direct-vs-recursive file counts with the most-recent date; `cat` shows the backlink and forward-link source paths (not just counts) and a coarse graph role (hub / connector / leaf / orphan); both render triage frontmatter (`status`, `type`) per file.
