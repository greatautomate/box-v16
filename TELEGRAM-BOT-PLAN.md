# MedusaXD Claude Bot

## Problem
Build **MedusaXD Claude Bot** — a Telegram bot (with an accompanying admin web app) that exposes all Upstash Box operations — creating/managing boxes, running AI agents, uploading/downloading files, selecting models, and more — entirely from Telegram.

## Current State
The `@upstash/box` SDK (v0.4.1) is a TypeScript library providing:
- **Box lifecycle**: `Box.create()`, `.get()`, `.list()`, `.delete()`, `.pause()`, `.resume()`, `.getStatus()`
- **Agent runs**: `box.agent.run()` (sync + structured output), `box.agent.stream()`, webhook mode
- **File I/O**: `box.files.read/write/list/upload/download`, base64 binary support
- **Exec**: `box.exec.command()`, `box.exec.code()`, streaming variants
- **Git**: clone, diff, status, commit, push, createPR, checkout
- **Snapshots**: create, list, delete, restore via `Box.fromSnapshot()`
- **Preview URLs**: `box.getPreviewUrl(port)` with optional auth
- **Schedules**: cron-based exec and agent schedules
- **Env vars**: user-level `Box.setEnv/listEnv/deleteEnv`
- **Model catalog** (from `packages/cli/src/models.ts`): ClaudeCode (Opus 4.5–4.8, Sonnet 4–4.6, Haiku 4.5), OpenAI Codex (GPT 5.1–5.4), OpenCode (free + paid + Anthropic/OpenAI/OpenRouter), Cursor, OpenRouter models
- **Agent harnesses**: `claude-code`, `codex`, `opencode`, `cursor`, `custom`

## Proposed Architecture

### Tech Stack
- **Runtime**: Node.js 18+ / TypeScript
- **Telegram Bot**: `grammy` (modern, TypeScript-first, middleware-based)
- **Web Admin**: Next.js 14 App Router (React Server Components, API routes)
- **Auth**: Simple JWT-based admin login (no external auth provider needed initially)
- **Database**: MongoDB Atlas via `mongoose` (stores admin users, bot config, user sessions, default settings — cloud-hosted, no disk persistence needed)
- **Monorepo**: New `packages/telegram-bot` directory alongside existing SDK/CLI

### Directory Layout
```
packages/telegram-bot/
├── src/
│   ├── bot/                  # Telegram bot core
│   │   ├── index.ts          # Bot entry point, middleware setup
│   │   ├── conversations/    # Multi-step conversation handlers
│   │   │   ├── create-box.ts # Box creation wizard
│   │   │   ├── run-agent.ts  # Prompt AI agent
│   │   │   └── upload-file.ts# File upload flow
│   │   ├── commands/         # Slash command handlers
│   │   │   ├── box.ts        # /create, /list, /get, /delete, /pause, /resume
│   │   │   ├── agent.ts      # /prompt, /stream
│   │   │   ├── files.ts      # /upload, /download, /ls
│   │   │   ├── git.ts        # /clone, /diff, /commit, /push, /pr
│   │   │   ├── snapshot.ts   # /snapshot, /restore
│   │   │   └── settings.ts   # /model, /runtime, /status
│   │   ├── keyboards/        # Inline keyboard builders
│   │   │   ├── models.ts     # Model selection keyboards
│   │   │   ├── boxes.ts      # Box list/action keyboards
│   │   │   └── common.ts     # Confirm/cancel, pagination
│   │   └── middleware/
│   │       ├── auth.ts        # Verify allowed Telegram user IDs
│   │       └── session.ts     # User session (active box, default model)
│   ├── web/                   # Next.js admin app
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx       # Dashboard: active boxes, recent runs
│   │   │   ├── login/page.tsx
│   │   │   ├── boxes/page.tsx # Box management UI
│   │   │   ├── settings/page.tsx # Bot config, default model, allowed users
│   │   │   └── api/
│   │   │       ├── auth/route.ts
│   │   │       ├── boxes/route.ts
│   │   │       └── webhook/route.ts  # Telegram webhook endpoint
│   │   └── components/
│   ├── services/              # Shared business logic
│   │   ├── box-manager.ts    # Wraps @upstash/box SDK, manages active boxes
│   │   ├── model-registry.ts # Re-exports model catalog from CLI
│   │   ├── file-handler.ts   # Telegram file download → Box upload bridge
│   │   └── session-store.ts  # Per-user state (active box ID, defaults)
│   ├── db/
│   │   ├── models/            # Mongoose models
│   │   │   ├── session.ts     # User session model
│   │   │   ├── bot-config.ts  # Runtime config (API keys, allowed users)
│   │   │   └── admin.ts       # Admin user model
│   │   └── index.ts           # Mongoose connection
│   └── config.ts              # Env vars, constants
├── package.json
├── tsconfig.json
└── .env.example
```

## Feature Breakdown

### 1. Telegram Bot Commands

**Box Management**
- `/create` — Interactive box creation (inline keyboards for runtime → agent harness → model → API key type → confirm). Replicates the CLI wizard flow from `packages/cli/src/commands/create-wizard.ts`.
- `/list` — List all boxes with inline keyboard buttons for quick actions (connect, delete, pause/resume)
- `/delete <box-id>` — Delete a box with confirmation
- `/pause` / `/resume` — Lifecycle control on the active box
- `/status` — Show active box status, model, runtime, token usage
- `/connect <box-id>` — Set a box as the "active" box for the session

**Shell Execution**
- `/exec <command>` — Run a shell command directly in the active box via `box.exec.command()`. Output sent as `<pre>` block, or as a `.txt` document if too long. Supports chained commands: `/exec npm install && npm run build`
- `/code <lang> <code>` — Run inline code: `/code js console.log(1+1)` or `/code python print("hello")`. Uses `box.exec.code()`.

**Preview URLs**
- `/preview <port>` — Get a public URL for an exposed port. e.g. `/preview 3000` returns a clickable `https://{id}-3000.preview.box.upstash.com` link. Uses `box.getPreviewUrl(port)`.
- `/preview <port> auth` — Get an authenticated preview URL (bearer token or basic auth).
- `/previews` — List all active preview URLs for the box.

**AI Agent**
- `/prompt <text>` — Run agent on active box, stream response back as Telegram messages (chunked to respect 4096-char limit). Uses `box.agent.run()` with `onToolUse` callback to show tool invocations inline.
- Direct message (no command prefix) when a box is active → treated as a prompt to the agent
- `/stream <text>` — Explicit streaming mode using `box.agent.stream()`, edits a single message in real-time
- `/newchat` — Reset the agent session (clear conversation context, start fresh). Creates a new box session so the agent forgets previous prompts.
- `/history` — Show recent prompts and response summaries for the active box via `box.listRuns()`. Displays prompt, status, cost, and truncated output.

**File Operations**
- Send any document/photo to the bot → auto-uploads to active box via `box.files.write()`. **Archive auto-extract**: if the file is a `.zip`, `.tar.gz`, `.tar.bz2`, or `.tgz`, the bot uploads it to `/tmp/` in the box, extracts into `cwd` via `box.exec.command("unzip /tmp/archive.zip -d .")` or `tar xzf`, deletes the archive, and replies with the extracted file tree (`box.files.list()`). Regular files go straight to `cwd`.
- `/upload [destination-path]` — Sets the destination for the next file sent. e.g. `/upload src/config/` then send a file → it lands at `src/config/filename`. Without this, files go to `cwd`.
- `/download [path]` — Download a single file from the box, sent back as a Telegram document
- `/zip [path]` — Zip and download. Supports both strict paths and natural language:
    - `/zip` (no args) — zips the entire project (`cwd`), sends as `project.zip`
    - `/zip src/` — zips a specific folder
    - `/zip src/main.ts utils/helper.ts` — zips specific files
    - `/zip the whole project` / `/zip everything` / `/zip send me all files` — smart parsing detects natural language intent and zips entire project
  **Smart arg parsing** (`parseZipArgs()`): checks if args contain path-like tokens (has `/`, `.ext`, or starts with `.`) → treat as paths. Otherwise checks for intent keywords (`whole`, `entire`, `project`, `everything`, `all`, `send`) → treat as zip-all. Falls back to a help message if args are ambiguous.
  Implementation: runs `zip -r /tmp/export.zip <target>` inside the box via `box.exec.command()`, reads the zip back with `box.files.read("/tmp/export.zip", { encoding: "base64" })`, converts to Buffer, sends via `ctx.replyWithDocument()`. Cleans up with `box.exec.command("rm /tmp/export.zip")`. Telegram file limit is 50 MB for bots — if the zip exceeds this, the bot replies with an error suggesting `/zip` on a smaller path.
- `/ls [path]` — List files in box workspace

**Git**
- `/clone <repo> [branch]` — Clone repo into active box
- `/diff` — Show git diff (sent as code block or document if too long)
- `/commit <message>` — Commit changes
- `/push [branch]` — Push to remote
- `/pr <title>` — Create pull request

**Snapshots**
- `/snapshot [name]` — Create snapshot of active box
- `/snapshots` — List snapshots
- `/restore <snapshot-id>` — Create new box from snapshot

**Settings**
- `/model` — Show inline keyboard to select default AI model (grouped by harness like the CLI wizard). Uses the model catalog from `packages/cli/src/models.ts`.
- `/runtime` — Change default runtime for new boxes
- `/env set KEY=VALUE` / `/env list` / `/env delete KEY` — Manage user-level env vars
- `/keepalive on|off` — Set the default keep-alive preference for **new** boxes. When on (the default), boxes are created with `keepAlive: true` so the Upstash platform never idle-pauses them; when off, boxes use the platform's pause-based idle lifecycle. Stored per-user in MongoDB (`defaultKeepAlive`) and used to seed the create wizard's keep-alive step. Manual `/pause` and `/resume` remain available for explicit lifecycle control.

**Schedules**
- `/schedule exec "<cron>" <command>` — Create a cron-based exec schedule. e.g. `/schedule exec "0 */6 * * *" npm test`. Uses `box.schedule.exec()`.
- `/schedule prompt "<cron>" <prompt>` — Create a cron-based agent prompt schedule. e.g. `/schedule prompt "0 9 * * *" run tests and report results`. Uses `box.schedule.agent()`.
- `/schedules` — List all schedules for the active box with inline keyboards to pause/resume/delete.
- `/schedule delete <id>` — Delete a schedule.

**Help**
- `/help` — Contextual help. Shows different command groups based on state:
    - No active box: shows box management commands (`/create`, `/list`, `/connect`)
    - Box active: shows full command list grouped by category
    - Admin users: additionally shows admin commands (`/setapikey`, `/adduser`, etc.)
    - Each command has a one-line description in `<code>` formatting

### 2. Web Admin Panel

**Auth**: Simple username/password login → JWT stored in httpOnly cookie.

**Dashboard**
- Overview: number of active boxes, total runs today, total cost
- Recent agent runs with status, cost, output preview

**Box Management**
- Table of all boxes with status, model, runtime, created date
- Actions: delete, pause/resume, view details
- Create new box form (mirrors Telegram wizard)

**Settings Page**
- Default model/harness/runtime configuration
- Allowed Telegram user IDs (who can use the bot)
- Bot token management
- Upstash Box API key configuration

**Webhook Endpoint**
- `POST /api/webhook` — Telegram webhook receiver (alternative to polling)
- `POST /api/webhook/box` — Receive Upstash Box webhook callbacks for async runs

### 3. Admin Bot Commands

Admin-only commands (restricted to `ADMIN_TELEGRAM_IDS`):
- `/setapikey <key>` — Update the `UPSTASH_BOX_API_KEY` at runtime. Persists to MongoDB `bot_config` collection so it survives restarts. The `box-manager` service reads the key from DB first, falling back to the env var.
- `/setagentkey <key>` — Update the default `AGENT_API_KEY` the same way.
- `/adduser <telegram-id>` / `/removeuser <telegram-id>` — Manage allowed user list at runtime.
- `/botconfig` — Show current config (keys masked, allowed users, default model/harness).

### 4. Session Management

Each Telegram user gets a session (stored in MongoDB `sessions` collection) tracking:
- `activeBoxId` — The box they're currently interacting with
- `defaultModel` — Their preferred model (e.g., `ClaudeCode.Opus_4_8`)
- `defaultHarness` — Their preferred harness (e.g., `claude-code`)
- `defaultRuntime` — Their preferred runtime (e.g., `node`)

### 5. Key Implementation Details

**Telegram ↔ Box File Bridge** (`file-handler.ts`)

Regular file upload:
1. User sends document to Telegram bot
2. Bot calls Telegram `getFile` API → gets file URL
3. Downloads file to temp buffer
4. Checks if session has a pending `uploadDestination` (set by `/upload <path>`) — if so, use that path; otherwise use `cwd/filename`
5. Calls `box.files.write({ path, content, encoding: "base64" })` → confirms with file path

Archive upload (project upload):
1. User sends `.zip` / `.tar.gz` / `.tgz` / `.tar.bz2`
2. Bot downloads and uploads to `/tmp/<filename>` in the box via `box.files.write()`
3. Detects archive type by extension, runs extract command:
    - `.zip` → `box.exec.command("unzip -o /tmp/archive.zip -d .")`
    - `.tar.gz` / `.tgz` → `box.exec.command("tar xzf /tmp/archive.tar.gz")`
    - `.tar.bz2` → `box.exec.command("tar xjf /tmp/archive.tar.bz2")`
4. `box.exec.command("rm /tmp/<filename>")` — cleanup
5. `box.files.list()` → replies with extracted file tree

Telegram upload limit: bot can download files up to 20 MB via `getFile`. For larger archives, the bot replies with instructions to use a direct URL (`/fetch <url>` — runs `wget` inside the box).

**Zip & Send Flow** (`file-handler.ts` — `zipAndSend()`)
1. `box.exec.command("zip -r /tmp/export.zip <target>")` — zip inside the box (avoids downloading many files individually)
2. `box.exec.command("stat -c %s /tmp/export.zip")` — check size; abort if >50 MB (Telegram bot upload limit)
3. `box.files.read("/tmp/export.zip", { encoding: "base64" })` — read zip as base64
4. `Buffer.from(base64, "base64")` → `new InputFile(buffer, "project.zip")` → `ctx.replyWithDocument()`
5. `box.exec.command("rm /tmp/export.zip")` — cleanup

**Streaming Agent Responses**
- Use `box.agent.stream()` and accumulate text-delta chunks
- Edit a single Telegram message every ~500ms with accumulated text (Telegram rate limits: 30 msg/sec per chat, max 4096 chars)
- If output exceeds 4096 chars, split into multiple messages (each ≤4096), final overflow sent as `.txt` document
- Show tool use events as italic annotations: `<i>🔧 Read(src/main.ts)</i>`

**Conversation Flow in Telegram**
- The Box agent maintains conversation context server-side via `session_id` — the bot does not need to replay history. Multi-turn works automatically within the same box.
- Bot formats responses as **reply chains**: agent response is sent as a reply to the user's prompt message (`reply_to_message_id`), creating a readable thread.
- `/newchat` resets the session — implemented by deleting the box's current `session_id` (or creating a fresh agent session via the API).
- `/history` fetches `box.listRuns()` and formats recent runs as a numbered list.

**HTML Formatting** (`parse_mode: "HTML"`)

All bot messages use Telegram HTML mode. A `formatResponse()` utility converts agent output:
- Agent text output → `<b>bold</b>`, `<i>italic</i>`, `<code>inline code</code>`
- Code blocks → `<pre><code class="language-ts">...</code></pre>`
- Tool use events → `<i>🔧 Using: Read(src/auth.ts)</i>`
- File paths → `<code>src/main.ts</code>`
- Status messages → `<b>✅ Box created</b>  ID: <code>box_abc123</code>`
- Errors → `<b>❌ Error:</b> <code>message</code>`
- Cost/token info → `<b>Tokens:</b> 1,234 in / 5,678 out — <b>$0.02</b>`
- The formatter strips/escapes `<`, `>`, `&` in raw agent output to prevent HTML injection, then applies formatting.

**Colored Button Styles** (Bot API 9.4 — `style` field)

grammy natively supports the `style` property via `.danger()`, `.success()`, `.primary()` chain methods. We use them semantically throughout:
- 🔴 `danger` (red): destructive actions — Delete box, Cancel, Remove user
- 🟢 `success` (green): confirmations — Create box, Confirm, Connect, Push
- 🔵 `primary` (blue): navigation/info — Prompt, Browse files, Status, Preview
- No style (default gray): neutral actions — Back, Close, pagination arrows

Examples:
```ts
// Box list actions
new InlineKeyboard()
  .text("Connect", "connect:box123").success()
  .text("Delete", "delete:box123").danger().row()
  .text("Pause", "pause:box123").primary()
  .text("Status", "status:box123")

// Delete confirmation
new InlineKeyboard()
  .text("Yes, delete", "confirm-delete:box123").danger()
  .text("Cancel", "cancel-delete")

// Create wizard - runtime selection
new InlineKeyboard()
  .text("Node.js", "rt:node").primary()
  .text("Python", "rt:python").primary().row()
  .text("Go", "rt:golang").text("Ruby", "rt:ruby").text("Rust", "rt:rust")
```

Also supports `icon_custom_emoji_id` via `.icon()` for premium bots — can show custom icons next to button text.

**Model Selection Keyboard**

Re-use `MODEL_OPTIONS_BY_AGENT` from `packages/cli/src/models.ts` to build paginated inline keyboards grouped by harness.

**Async Run Notifications**

For long-running agent tasks (>30s), the bot uses webhook mode:
1. `box.agent.run({ prompt, webhook: { url: WEBHOOK_URL + "/box", headers } })` — fire-and-forget
2. Bot immediately replies: `<i>⏳ Task submitted… I'll notify you when it's done.</i>`
3. `POST /api/webhook/box` receives `WebhookPayload` on completion
4. Bot sends a push notification to the user's Telegram chat with the result
5. Run status + cost stored in MongoDB for `/history`

**Keep-alive**

Idle lifecycle is delegated to the Upstash platform via the `keepAlive` flag on `Box.create`, rather than a bot-side timer. The create wizard adds a keep-alive step (🔥 Always on / 💤 Allow auto-pause) seeded from the user's `defaultKeepAlive` preference; the chosen value is passed to `createBox({ keepAlive })`. With keep-alive on (the default), the platform never idle-pauses the box; with it off, the platform's own pause-based idle lifecycle applies. There is no background `setInterval` — the earlier per-box auto-pause loop was removed in favor of this.

## Environment Variables

```
# Bot
TELEGRAM_BOT_TOKEN=           # From @BotFather
ADMIN_TELEGRAM_IDS=           # Comma-separated allowed user IDs
# Database
MONGODB_URI=                  # MongoDB Atlas connection string
# Upstash Box
UPSTASH_BOX_API_KEY=          # Box API key (can be updated at runtime via /setapikey)
AGENT_API_KEY=                # Optional: default agent LLM key (updatable via /setagentkey)
# Web Admin
ADMIN_USERNAME=
ADMIN_PASSWORD_HASH=
JWT_SECRET=
NEXT_PUBLIC_BASE_URL=
# Deployment
PORT=3000                     # Web admin port
BOT_MODE=polling              # "polling" for dev/VPS, "webhook" for Render/production
WEBHOOK_URL=                  # Required when BOT_MODE=webhook (e.g. https://your-app.onrender.com/api/webhook)
```

## Deployment

### Render
- **Web Service**: Build command `pnpm --filter telegram-bot build`, start command `node packages/telegram-bot/dist/main.js`
- Set `BOT_MODE=webhook` and `WEBHOOK_URL=https://<app>.onrender.com/api/webhook`
- No persistent disk needed — all state is in MongoDB Atlas
- The app auto-registers the Telegram webhook on startup when `BOT_MODE=webhook`
- Include a `render.yaml` (Blueprint) for one-click deploy:

```yaml
services:
  - type: web
    name: medusaxd-claude-bot
    runtime: node
    buildCommand: pnpm install && pnpm --filter telegram-bot build
    startCommand: node packages/telegram-bot/dist/main.js
    envVars:
      - key: BOT_MODE
        value: webhook
      - key: WEBHOOK_URL
        fromService: ...
```

### VPS (Ubuntu/Debian)
- Clone repo, `pnpm install && pnpm --filter telegram-bot build`
- Set `BOT_MODE=polling` (simpler, no public URL needed)
- Run via `pm2` or `systemd` unit:

```ini
[Unit]
Description=MedusaXD Claude Bot
After=network.target
[Service]
WorkingDirectory=/opt/medusaxd-claude-bot
ExecStart=/usr/bin/node packages/telegram-bot/dist/main.js
Restart=always
EnvironmentFile=/opt/medusaxd-claude-bot/.env
[Install]
WantedBy=multi-user.target
```

- Optional: Nginx reverse proxy to expose the web admin panel on port 443 with SSL

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/telegram-bot/package.json packages/telegram-bot/
COPY packages/sdk/package.json packages/sdk/
RUN corepack enable && pnpm install --frozen-lockfile
COPY packages/sdk packages/sdk
COPY packages/telegram-bot packages/telegram-bot
RUN pnpm --filter @upstash/box build && pnpm --filter telegram-bot build
EXPOSE 3000
CMD ["node", "packages/telegram-bot/dist/main.js"]
```

Works with `docker compose` for local dev or any container platform (Fly.io, Railway, etc.).

### Startup Flow (`main.ts`)
1. Connect to MongoDB Atlas via `mongoose.connect(MONGODB_URI)`
2. Read `BOT_MODE` env var
3. If `webhook`: start Express/Next.js server, register Telegram webhook via `bot.api.setWebhook(WEBHOOK_URL)`
4. If `polling`: start Next.js server on `PORT`, then `bot.start()` for long polling
5. Both modes serve the web admin on the same `PORT`

## Implementation Order
1. Scaffold `packages/telegram-bot` with package.json, tsconfig, dependencies
2. MongoDB connection + Mongoose models (`sessions`, `bot_config`, `admins`)
3. Bot core: grammy setup, middleware (auth, session), command registration
4. `box-manager.ts` service wrapping @upstash/box SDK (reads API key from DB → env fallback)
5. `model-registry.ts` — re-export model catalog
6. Box management commands (`/create`, `/list`, `/connect`, `/delete`, `/status`)
7. Admin commands (`/setapikey`, `/setagentkey`, `/adduser`, `/removeuser`, `/botconfig`)
8. Agent commands (`/prompt`, streaming, direct message handler)
9. Shell execution (`/exec`, `/code`) and preview URLs (`/preview`)
10. File operations (upload via document, `/download`, `/zip`, `/ls`)
11. Git commands (`/clone`, `/diff`, `/commit`, `/push`, `/pr`)
12. Snapshot commands (`/snapshot`, `/restore`)
13. Schedule commands (`/schedule exec`, `/schedule prompt`, `/schedules`)
14. Settings commands (`/model`, `/runtime`, `/env`, `/keepalive`)
15. `/help` — contextual help command
16. Async run notifications (webhook receiver + Telegram push)
17. Web admin: Next.js scaffold, auth, dashboard, box management, settings
18. Deployment: `main.ts` startup, Dockerfile, `render.yaml`, systemd unit
19. Testing + documentation
