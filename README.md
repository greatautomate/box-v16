# Upstash Box

CLI and Telegram bot for [Upstash Box](https://upstash.com/docs/box) — sandboxed AI coding agents with streaming, structured output, file I/O, git, and snapshots. Both are built on the published [`@upstash/box`](https://www.npmjs.com/package/@upstash/box) SDK.

## Packages

| Package | Description |
|---------|-------------|
| [`@upstash/box-cli`](./packages/cli) | CLI — REPL-first terminal interface wrapping the SDK |
| [`@medusaxd/claude-bot`](./packages/telegram-bot) | Telegram bot + web admin panel for managing Boxes (private, not published) |

## Quick start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Watch mode (both packages)
pnpm dev
```

## Repository structure

```
.
├── packages/
│   ├── cli/            # @upstash/box-cli — CLI + interactive REPL
│   │   └── src/
│   └── telegram-bot/   # @medusaxd/claude-bot — Telegram bot + web admin
│       └── src/        # bot/, services/, db/, web/
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## Testing

Tests use [Vitest](https://vitest.dev):

- **Unit tests** — mock all API calls, fast, no credentials needed. Run with `pnpm test` (covers the `cli` and `telegram-bot` packages).
- **Integration tests** — hit the real Box API and require env vars. These live in the `@upstash/box` SDK package, which is consumed from npm and is **not** part of this repository, so `pnpm test:integration` only runs when that package is present.

### Environment variables

Create a `.env` file at the repository root:

```
UPSTASH_BOX_API_KEY=abx_...
AGENT_API_KEY=sk-ant-...
```

Integration tests are automatically skipped when these variables are not set.

### Commands

```bash
# Run all tests (unit + integration if .env is present)
pnpm test

# Run only integration tests
pnpm test:integration

# Run tests for a single package
cd packages/cli && pnpm test
cd packages/telegram-bot && pnpm test
```

## Releasing

This repo uses [Changesets](https://github.com/changesets/changesets) for versioning and automated npm publishing via OIDC.

### Stable release

1. Create a changeset while working on your feature:
   ```bash
   pnpm changeset
   ```
2. Merge your PR to `main`. The **Changeset** workflow creates a "Version Packages" PR that bumps versions and updates changelogs.
3. Merge the version PR. The workflow tags the release, creates a GitHub Release, and triggers **npm Publish** which publishes to npm.

### Canary release

1. Create a branch, make your changes, run `pnpm changeset` to create a changeset, and push the branch to GitHub.
2. Go to **Actions → Canary Release → Run workflow**, pick a package and the branch.
3. The workflow creates a [snapshot version](https://github.com/changesets/changesets/blob/main/docs/snapshot-releases.md) (e.g. `0.2.0-canary-20260219131415-abc1234`), publishes to npm under the `canary` tag, and creates a GitHub prerelease.

### Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | PR + push to main | Build and test (Node 18/20/22) |
| `changeset.yml` | Push to main | Version PR or tag + GitHub Release |
| `canary.yml` | Manual dispatch | Snapshot version + GitHub prerelease |
| `npm-publish.yml` | `workflow_run` (after changeset/canary) | Publish to npm with OIDC provenance |

`npm-publish.yml` is the sole npm trusted publisher — configure it on npmjs.com for the published `@upstash/box-cli` package (`@medusaxd/claude-bot` is private and never published). No npm tokens or PATs required.

## Requirements

- Node.js >= 18
- pnpm

## License

MIT
