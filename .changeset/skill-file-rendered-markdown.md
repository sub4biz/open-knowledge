---
"@inkeep/open-knowledge": patch
---

Render a global skill's `.md`/`.mdx` references as formatted read-only markdown instead of raw source.

Opening a global skill bundle file in the Skills sidebar previously showed the raw markdown source. Markdown references now render formatted (headings, bold, lists) read-only — the same rendering the editor uses (via the shared extension set, with no editing and no collaboration binding). Scripts and other non-markdown files keep the source view.
