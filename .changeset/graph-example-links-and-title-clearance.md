---
"@inkeep/open-knowledge": patch
---

Keep illustrative example links in the starter packs out of the link graph, and
clear the fullscreen graph title from the macOS traffic-light buttons.

Several starter-pack examples used forms that the link indexer still extracts,
so docs seeded or instantiated from them carried links to placeholder targets
(`path/to/doc-a`, `companies/acme`, `another-concept`, …) that surfaced as
phantom dead-links and red "missing" nodes in the graph:

- The entity-vault `log.md` wrapped its "Example entry shape" block in an HTML
  comment. Comments don't render, but the indexer reads links inside them — it
  is now a fenced `markdown` code block (which the indexer skips), matching the
  knowledge-base pack. The example also renders as a visible, copyable template.
- The entity-vault person/company/meeting templates and the OKF concept template
  had bare example links in their instructional prose, which every instantiated
  dossier/concept then inherited. They are now inline code, matching how the
  folder descriptions already write the same examples.

To exclude an example link from the broken-link detector in your own docs, put
it in a code fence (block) or inline code (inline) — an HTML comment will not.

In the expanded (fullscreen) graph, the "GRAPH" title sat flush against the
macOS traffic-light buttons: the header's safe-area reserve clears the button
footprint, but the flush-left title was left touching the buttons. The left
title cluster now gets a small margin in fullscreen so it clears them; the
header keeps the shared safe-area reserve token unchanged.
