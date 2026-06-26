---
"@inkeep/open-knowledge-server": patch
"@inkeep/open-knowledge": patch
---

Fix a starter-pack skill being unable to reinstall after a user uninstalls it. Pack skills are named `open-knowledge-pack-<packId>`, which sits under the `open-knowledge*` prefix reserved for OK's shipped skills. The seed installs them by copying directly, but a user-triggered reinstall re-runs the install validation, which rejected the reserved prefix and failed with "uses the reserved `open-knowledge*` prefix." The install guard now exempts the `open-knowledge-pack-*` namespace (OK's own shipped pack content), so reinstalling a pack skill works while user-authored `open-knowledge*` names stay blocked.
