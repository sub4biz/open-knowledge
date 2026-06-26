---
"@inkeep/open-knowledge": patch
"@inkeep/open-knowledge-server": patch
"@inkeep/open-knowledge-app": patch
---

Make skills URL-addressable in the editor and resolvable by the MCP, so a skill behaves like a document. The skill editor now has its own route (`#/__skill__/<scope>/<name>`): opening a skill updates the URL, so it is reload-stable, shareable, and deep-linkable; loading a skill URL opens straight into the editor with the file sidebar visible. Closing routes the URL back to the document underneath, and navigating to a document dismisses the skill editor. The `write` and `edit` MCP tools now ride a route-only `previewUrl` for skills (the same preview envelope documents already carry), and the `preview_url` tool accepts a `{ skill }` target, so an agent that authors a skill in Open Knowledge can hand back a URL that opens it in the running editor.

Creating a skill now opens the editor directly instead of a modal: the "New skill" action drops a draft into the main editor pane with an inline Project/Personal scope toggle in its Properties panel. Filling in a name and description enables Create; once it commits, the editor re-points to the saved skill and switches into the same autosave edit experience, so authoring a new skill and editing an existing one are one continuous surface.
