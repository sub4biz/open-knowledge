---
"@inkeep/open-knowledge": patch
---

Improve Cmd+K/omnibar search findability. Markdown files are now matchable by their full displayed name including the extension (typing `STORY.md` finds the page named `STORY`, matching how non-markdown files and the file tree already work). And a query that matches many same-named folders or files (e.g. `evidence`, `index`) no longer fills the entire result list with one kind — folders and files are each capped (default 3) so content pages get the remaining slots; full-text search is uncapped.
