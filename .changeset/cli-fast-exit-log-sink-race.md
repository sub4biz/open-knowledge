---
"@inkeep/open-knowledge": patch
---

Fast-exiting CLI commands no longer dump a wall of minified bundle source to the terminal. Commands that exit within the same tick as startup — most visibly `ok start` in a directory that hasn't been `ok init`'d — raced the asynchronous open of the CLI's diagnostics log file: pino's exit-time flush hook then threw `sonic boom is not ready yet` on the never-opened file descriptor, burying the real one-line message under the error and a giant minified code frame. The log-file destination now opens synchronously, so the exit-time flush always finds a ready file descriptor and the clean message (e.g. "Run `ok init` first") is all you see.
