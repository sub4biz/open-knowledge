---
"@inkeep/open-knowledge": patch
---

Fix Open Knowledge Desktop offering to set up a project inside a subfolder of a linked git worktree. Picking a subdirectory (for example `public/open-knowledge`) inside a `git worktree add` checkout misclassified it as a worktree root and showed "Setup Open Knowledge in this folder" in place, scaffolding `.ok/` in the subfolder instead of promoting to the git root. Subfolders of a linked worktree now correctly fall through to git-root promotion; only the worktree root itself is treated as a standalone project.
