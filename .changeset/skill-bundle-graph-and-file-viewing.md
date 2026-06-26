---
"@inkeep/open-knowledge-core": patch
"@inkeep/open-knowledge-server": patch
"@inkeep/open-knowledge": patch
---

Make a project skill's references show up connected in the graph, and let global skill bundle files be opened.

- A project skill's `SKILL.md` and its `references/*.md` now appear connected in the link graph automatically, whether the body references them as `[[wiki-links]]` or as plain backticked paths. The references were already graph nodes; this adds the structural edges between a skill's `SKILL.md` and its own reference docs, derived strictly from the bundle path (`.ok/skills/<name>/`). Regular documents and folders are unaffected — co-membership in an ordinary folder does not create edges. Authored wiki-links keep working and are not double-drawn.
- Clicking a global skill's reference or script in the Skills sidebar now opens it (read-only) instead of failing with "could not be found." Global skill bundle files live in `~/.ok/skills/` outside the project content tree, so they are now read through the scope-aware skill-file endpoint rather than as a project content-dir asset. A fetch failure shows a terminal state instead of a perpetual loading spinner.
- The write-skill guidance is updated: project skill references auto-connect in the graph regardless of how they are referenced, a wiki-link is only needed for a clickable inline link, and global skill references should stay plain backtick paths since global references are not graph docs.
