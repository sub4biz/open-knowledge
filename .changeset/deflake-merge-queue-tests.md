---
"@inkeep/open-knowledge-server": patch
---

Make the local telemetry file sink flush spans on span end (SimpleSpanProcessor) so `ok diagnose bundle` reliably captures spans — previously a batch-timer vs shutdown-timeout race could drop them under load. Also make project template enumeration order deterministic across filesystems by sorting the directory walk, so which templates fall inside the scan cap is stable run to run.
