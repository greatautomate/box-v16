---
"@medusaxd/claude-bot": patch
---

Security and correctness fixes for the Telegram bot:

- **Shell injection:** uploaded archive/file names and zip targets are now
  shell-quoted and sanitized, and the archive temp path no longer embeds the
  raw filename, so a crafted filename can no longer inject shell commands into
  the box.
- **Authorization:** added per-user box ownership — creators are recorded and
  only the owner (or an admin) may connect/delete/pause/resume/inspect a box;
  the box list is filtered per user. Boxes without a recorded owner stay shared
  for backward compatibility.
- **Webhook auth:** the Telegram webhook validates the `secret_token`, and the
  box-notification webhook requires a shared secret (404 when unconfigured,
  401 on mismatch).
- **Auth fail-closed:** with no allow-list configured the bot denies everyone
  unless `ALLOW_ALL_USERS=true` is explicitly set.
- **Web admin cookie:** the auth cookie is marked `secure` in webhook mode and a
  logout route clears it.
- **Markdown→HTML:** links now reject non-web schemes (e.g. `javascript:`) and
  escape quotes so a crafted URL can't break out of the `href` attribute.
- **Config:** canonicalized on `ADMIN_PASSWORD`, fixed the Render build command,
  and added `WEBHOOK_SECRET` / `BOX_WEBHOOK_SECRET`.
- **Misc:** `getSession` uses an atomic upsert to avoid a duplicate-key race,
  and `/newchat` no longer falsely claims to reset server-side agent state.

Adds a Vitest setup with unit tests for the bot's path-containment and
Markdown-to-HTML helpers.
