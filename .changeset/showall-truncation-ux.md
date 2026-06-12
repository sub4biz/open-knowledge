---
"@inkeep/open-knowledge": patch
---

Show All Files sidebar overhaul. The recursive listing walk now emits in level order, so hitting the entry cap drops the deepest entries first instead of arbitrarily starving top-level items behind one huge subtree. The sidebar no longer walks the whole tree up front in Show All mode: it seeds the root level lazily, fetches each folder's children on expand, and revalidates only the root plus currently-expanded folders when files change externally. The truncation and listing-error notices now render as contained, localized alert rows, and the truncation copy is truthful: it shows a locale-formatted count and explains that deeply nested files are hidden (the previous copy claimed search could find them, which it cannot — show-all-only files are not in the search index).
