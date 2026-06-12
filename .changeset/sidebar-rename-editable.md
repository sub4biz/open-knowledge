---
"@inkeep/open-knowledge": patch
---

Keep the desktop editor editable after creating and inline-renaming successive sidebar files in packaged builds. The editor now repairs a stale TipTap `EditorContent` portal attachment after rename churn and avoids clearing the freshly reopened destination provider during active renames.
