---
"@inkeep/open-knowledge-core": patch
"@inkeep/open-knowledge-server": patch
"@inkeep/open-knowledge": patch
---

Show global skill references in the link graph, connected to their skill.

A global skill's `SKILL.md` and its `references/*.md` now appear as connected nodes in the link graph, the same as a project skill — even though global skills live in `~/.ok/skills/` outside the project content tree. Global bundle docs are ingested as graph nodes (at boot, on branch switch, and live via the managed-artifact watcher) and connected by structural edges derived from the bundle path. The connection is within-bundle only: a global skill is never linked into a specific project's knowledge base (a global reference's wiki-links are not followed), and its cluster is visible from every project since global skills are shared across all of them. Clicking a global reference node in the graph opens it read-only through the scope-aware skill-file viewer.
