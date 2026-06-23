---
"@inkeep/open-knowledge": patch
---

Fix stale source-mode editor styling on backgrounded documents. Switching between light and dark mode (or toggling word wrap) previously only updated the focused document — other open documents kept the prior theme's syntax highlighting (washed-out colors) or the prior word-wrap setting until a hard refresh.

The theme, word-wrap, and placeholder CodeMirror compartments are now stored with the cached editor view instead of per React component. Because editor views are cached and reparented across tab switches while their component remounts, a per-component compartment was absent from the reused view's config, so the reconfigure on theme/setting change was a silent no-op. Reopening a backgrounded document now re-applies the current settings.
