---
"@inkeep/open-knowledge": patch
---

Fix starter-pack templates showing their frontmatter as raw text in the editor.

Template files stored two stacked frontmatter blocks: the template's own title and description, then the frontmatter a new document receives. Editors only recognize the first block, so the second one leaked into the document body and showed up as raw `---` fences and `key: value` lines instead of editable properties.

Templates now use a single frontmatter block, with the template's identity under a reserved `template:` key and the new-document defaults as top-level keys. Creating a document from a template still produces the same frontmatter, with `{{date}}` and `{{user}}` substituted as before — including from an agent via `write({ document: { template } })`. Templates already on disk keep working and convert to the single-block shape the next time they are saved, so there is no migration step. This also fixes one starter template whose description contained an unquoted colon that broke YAML parsing, and adds a guard test so that class of bug cannot ship again.

The template edit dialog is reworked to match: the title field is labeled **Title**, a dedicated **Type** field carries the Open Knowledge Format `type`, and a **Default properties** editor exposes the rest of the new-document frontmatter as editable key/value rows — so the starter content is now plain markdown instead of a raw frontmatter block. Every document created from any starter template carries a semantic `type` plus a one-line `description` summarizing what that kind of document holds, which you then specialize per document.
