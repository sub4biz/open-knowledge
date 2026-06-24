---
"@inkeep/open-knowledge": patch
---

Tab rename UX: clicking an already-active tab pill opens its properties
popover (Notion-style); pressing Enter inside a single-line string input
in any PropPanel dismisses the popover.

UX research found users couldn't discover how to rename a tab — the pill
itself had no rename affordance, and the only path was a hover-revealed
chrome bar on the Tab body. Clicking the same pill twice now opens the
Tab Properties popover with the Label input focused, so a user who clicks
expecting to edit finds the rename surface on the very next click. The
gear button gained a `data-jsx-gear` attribute so Tabs.tsx can address it
without coupling to its i18n'd `aria-label`.

Enter on a single-line string input now matches the form-submit contract
every text input ships with — pressing Enter after typing acknowledges
"I'm done" and closes the popover. PropPanel auto-saves on every
keystroke, so Enter is acknowledgment, not commit; nothing about the
data path changes. Both PropPanel's plain `<Input>` branch and
SrcAutocomplete's empty-suggestion-list branch route through a new
`onDismiss` callback that JsxComponentView wires to its popover close.
CodeMirror code editors keep Enter as newline (multiline by design);
SrcAutocomplete's existing "Enter picks the highlighted suggestion"
contract takes priority when a suggestion is highlighted.
