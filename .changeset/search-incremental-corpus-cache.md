---
"@inkeep/open-knowledge": patch
---

Make the first search after an edit faster on large workspaces.

The workspace search index is rebuilt whenever the file index changes, and a rebuild previously re-read and re-parsed every markdown file on disk — so on a large workspace, the first search after any edit paid the cost of ingesting the entire corpus again. Each page's parsed search document is now reused across rebuilds when the watcher reports its file unchanged (by size, modified time, or inode), so a rebuild re-reads only the files that actually changed. Deleted and renamed pages drop out, and a failed read is retried rather than cached, so results stay current for typical edits.
