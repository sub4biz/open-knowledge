---
"@inkeep/open-knowledge": patch
---

Paint the sidebar file tree incrementally as the directory listing streams in, instead of withholding the whole level until the walk finishes. The `GET /api/documents` NDJSON walk is now applied to the tree per network chunk (additively, so folders not yet streamed are never pruned mid-stream), and the loading skeleton clears on the first batch. The authoritative prune + optimistic-merge reconcile still runs once as a single splice when the stream completes, so the final tree is unchanged. On a knowledge base with a large top-level directory the first rows appear sooner rather than after the entire level is enumerated.
