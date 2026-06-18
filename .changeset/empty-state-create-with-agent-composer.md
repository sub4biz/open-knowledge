---
"@inkeep/open-knowledge": patch
---

Add an AI prompt composer to the empty-state screens. Describe what you want to build and hand it off to your coding agent (Claude, Codex, or Cursor) — it composes a project brief and opens the agent to scaffold your knowledge base to match, using the same handoff path as "Open with AI". One-click starter prompts are tailored to the surface (build-from-scratch ideas on a brand-new project; spec / architecture prompts when the project already has content). The agent picker lists your installed agents and remembers your last choice per machine; when none are installed, Create is disabled with a hint.

The composer now leads both empty-state surfaces; the old "With AI" editor-launch cards and the "New file" card on the post-init screen are gone (a "or create a new file" link covers blank files). Starter-pack descriptions are shorter and friendlier, and the "Entity vault (GBrain-compatible)" pack is renamed "Personal CRM".

When OK runs embedded inside a host agent (Cursor/Codex/Claude) — where launching an agent would loop back — the empty state shows the same starter prompts as copy-to-paste rows instead, so you can grab one and paste it straight into the chat without leaving the agent.
