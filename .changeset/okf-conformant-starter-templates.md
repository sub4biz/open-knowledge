---
"@inkeep/open-knowledge": patch
---

Every `ok seed` starter pack now stamps a semantic `type` into the frontmatter of the documents its templates create, so a project scaffolded from any pack is conformant with Google's Open Knowledge Format (OKF v0.1) from the first document. The `knowledge-base`, `software-lifecycle`, `plain-notes`, and `writing-pipeline` packs gain context-appropriate types (for example `source`, `proposal`, `note`, `idea`); the `worldbuilding` and `entity-vault` packs already carried them. A conformance test now guards every pack's templates against the OKF non-empty-`type` rule.
