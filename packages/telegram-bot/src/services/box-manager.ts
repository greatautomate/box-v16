import {
  Box,
  type BoxConfig,
  type BoxData,
  type AgentConfig,
} from "@upstash/box";
import { config } from "../config.js";
import { getConfigValue } from "../db/models/bot-config.js";
import { BoxOwner } from "../db/models/box-owner.js";
import { isAdmin } from "../bot/middleware/auth.js";

/** Raised when a user tries to act on a box they do not own. */
export class BoxAccessError extends Error {
  constructor(boxId: string) {
    super(`You don't have access to server ${boxId}.`);
    this.name = "BoxAccessError";
  }
}

/** Record the creator of a box so later access can be authorized. */
export async function recordBoxOwner(
  boxId: string,
  telegramId: string,
): Promise<void> {
  await BoxOwner.findOneAndUpdate(
    { boxId },
    { boxId, telegramId },
    { upsert: true, new: true },
  );
}

/** Look up the Telegram ID that owns a box, or null if unrecorded (legacy). */
export async function getBoxOwnerId(boxId: string): Promise<string | null> {
  const owner = await BoxOwner.findOne({ boxId });
  return owner?.telegramId ?? null;
}

/**
 * Authorize a user to act on a box. Admins may touch any box. Boxes with no
 * recorded owner are treated as legacy/shared (allowed) so existing
 * deployments keep working; once a box has an owner, only that owner (or an
 * admin) may use it. Throws BoxAccessError on denial.
 */
export async function assertBoxAccess(
  boxId: string,
  telegramId: string,
): Promise<void> {
  if (isAdmin(telegramId)) return;
  const owner = await BoxOwner.findOne({ boxId });
  if (!owner) return; // legacy box, no ownership recorded
  if (owner.telegramId === telegramId) return;
  throw new BoxAccessError(boxId);
}

/** List boxes visible to a user: admins see all; others see owned + legacy. */
export async function listBoxesForUser(telegramId: string): Promise<BoxData[]> {
  const boxes = await listBoxes();
  if (isAdmin(telegramId)) return boxes;

  const owners = await BoxOwner.find({}, { boxId: 1, telegramId: 1 });
  const ownerByBox = new Map(owners.map((o) => [o.boxId, o.telegramId]));
  return boxes.filter((b) => {
    const owner = ownerByBox.get(b.id);
    return owner === undefined || owner === telegramId;
  });
}

/** Resolve the Upstash Box API key: DB first, then env var fallback. */
export async function getBoxApiKey(): Promise<string> {
  return getConfigValue("UPSTASH_BOX_API_KEY", config.upstashBoxApiKey);
}

/** Resolve the agent LLM API key: DB first, then env var fallback. */
export async function getAgentApiKey(): Promise<string> {
  return getConfigValue("AGENT_API_KEY", config.agentApiKey);
}

/** Create a new server with the given options. */
export async function createBox(opts: {
  runtime?: string;
  harness?: string;
  model?: string;
  size?: "small" | "medium" | "large";
  agentApiKey?: string;
  gitToken?: string;
  env?: Record<string, string>;
  keepAlive?: boolean;
}): Promise<Box> {
  const apiKey = await getBoxApiKey();

  const boxConfig: BoxConfig = {
    apiKey,
    runtime: (opts.runtime as BoxConfig["runtime"]) ?? "node",
    size: opts.size ?? "small",
    // Default to always-on so bot-created boxes aren't auto-paused by the
    // platform's idle lifecycle. Callers may opt out per box.
    keepAlive: opts.keepAlive ?? true,
  };

  if (opts.harness && opts.model) {
    boxConfig.agent = {
      harness: opts.harness,
      model: opts.model,
      apiKey: opts.agentApiKey || undefined,
    } as AgentConfig;
  }

  if (opts.gitToken) {
    boxConfig.git = { token: opts.gitToken };
  }

  if (opts.env && Object.keys(opts.env).length > 0) {
    boxConfig.env = opts.env;
  }

  return Box.create(boxConfig);
}

/** Get an existing box by ID. */
export async function getBox(boxId: string): Promise<Box> {
  const apiKey = await getBoxApiKey();
  return Box.get(boxId, { apiKey });
}

/** List all servers. */
export async function listBoxes(): Promise<BoxData[]> {
  const apiKey = await getBoxApiKey();
  return Box.list({ apiKey });
}

// Short-lived cache of box id → display name. Resolving a name for the cost
// footer / notifications otherwise costs a full listBoxes() API round-trip on
// every prompt; names change rarely, so a few seconds of staleness is fine.
const NAME_CACHE_TTL_MS = 30_000;
const nameCache = new Map<string, string>();
let nameCacheExpiresAt = 0;

/**
 * Resolve a human-readable name for a box, cached for {@link NAME_CACHE_TTL_MS}.
 * Falls back to a short id slice when the name is unknown or the API call fails
 * (a stale cache is preferred over an error).
 */
export async function getBoxName(boxId: string): Promise<string> {
  const now = Date.now();
  if (now >= nameCacheExpiresAt) {
    try {
      const boxes = await listBoxes();
      nameCache.clear();
      for (const b of boxes) {
        if (b.name) nameCache.set(b.id, b.name);
      }
      nameCacheExpiresAt = now + NAME_CACHE_TTL_MS;
    } catch {
      // Keep whatever is cached and retry on the next call.
    }
  }
  return nameCache.get(boxId) ?? boxId.slice(0, 12);
}

/** Delete a server by ID. */
export async function deleteBox(boxId: string): Promise<void> {
  const apiKey = await getBoxApiKey();
  await Box.delete({ apiKey, boxIds: boxId });
}
