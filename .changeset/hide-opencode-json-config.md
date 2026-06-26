---
"@inkeep/open-knowledge-core": patch
"@inkeep/open-knowledge-app": patch
---

Hide the seeded `opencode.json` agent config from the file tree

OpenKnowledge seeds `opencode.json` at the project root so OpenCode's MCP wiring works. Unlike the other agent configs (`.mcp.json`, `.cursor/`, `.codex/`), OpenCode's config filename is fixed and not dot-prefixed, so the dot-prefix "hidden file" convention skipped it and it surfaced as a normal file. A new `HIDDEN_CONFIG_BASENAMES` allowlist, consumed by `isHiddenDocName`, now classifies it as hidden everywhere the dotfile configs already are: the sidebar (behind the Show hidden files toggle), search ranking, and agent egress.
