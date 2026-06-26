---
"@inkeep/open-knowledge-core": patch
"@inkeep/open-knowledge-server": patch
"@inkeep/open-knowledge": patch
---

Fix skill reference graph links, the skills-dock flicker, and re-seed data safety.

- A `[[references/<name>]]` wiki-link inside a skill's SKILL.md now resolves to that skill's bundle reference doc and forms a real backlink and graph edge. Previously the natural wiki form silently mis-resolved to a phantom top-level doc (only an absolute `[[.ok/skills/<name>/references/<name>]]` or a markdown link resolved), so a skill's references never appeared as links or backlinks. Adds a shared `resolveSkillBundleWikiTarget` helper used by the link index, and updates the write-skill guidance to author references as wiki-links (a backtick code path renders dead and never joins the graph).
- The skills sidebar no longer flickers (list flashing empty then repopulating) on every skill create/edit/install/move. The list now revalidates in place instead of resetting to a loading state.
- Re-running seed no longer overwrites a user-edited starter-pack skill. `installPackSkill` only authors the source when it does not already exist; an existing skill keeps its edits and shadow history while still refreshing its editor projection and install marker.
- `POST /api/create-page` now rejects a path inside `.ok/` (or a managed-artifact doc name), so a page can no longer be created inside the indexed `.ok/skills/**` namespace and bypass skill-schema validation.
- The `install` MCP tool description now lists OpenCode (`.opencode/skills/`) as a valid projection target, matching the schema.
