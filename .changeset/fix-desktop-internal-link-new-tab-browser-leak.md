---
"@inkeep/open-knowledge": patch
---

Fix internal document links opening in the wrong place from the desktop app. "Open in new tab" (Cmd/Ctrl-click, or the link panel's open-in-new-tab) on an in-app document link now navigates to that document inside Open Knowledge. Previously the desktop window handler treated the in-app route as an external URL: in development builds this opened a `localhost` tab in your web browser (and repeated follows could flood the browser with tabs), and in packaged builds the click did nothing.
