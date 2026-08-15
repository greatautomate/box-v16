---
"@upstash/box-cli": patch
---

Harden and fix the CLI:

- `open-url` REPL action now uses `execFile` instead of `exec`, preventing host
  shell command injection from agent-provided URLs.
- `env list` masks secret values; `env set KEY=VALUE` rejects empty keys.
- `get` now prints full box details (id, status, harness, model) instead of just the id.
- Added `snapshot` and `env` to the bash/zsh shell completions.
- The CLI version is now read from `package.json` rather than hardcoded.
