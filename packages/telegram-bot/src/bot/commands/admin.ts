import type { BotContext } from "../middleware/session.js";
import { setConfigValue, getConfigValue } from "../../db/models/bot-config.js";
import { config } from "../../config.js";
import { fmtSuccess, fmtError, escapeHtml } from "../../services/format.js";

export async function setApiKeyCommand(ctx: BotContext): Promise<void> {
  const key = ctx.match?.toString().trim();
  if (!key) {
    await ctx.reply(fmtError("Usage: /setapikey &lt;key&gt;"), {
      parse_mode: "HTML",
    });
    return;
  }
  await setConfigValue("UPSTASH_BOX_API_KEY", key);
  // Delete the message containing the key for security
  try {
    await ctx.deleteMessage();
  } catch {
    /* may fail in groups */
  }
  await ctx.reply(fmtSuccess("Upstash Box API key updated"), {
    parse_mode: "HTML",
  });
}

/**
 * Show the Box API key currently in use, unmasked. Mirrors the precedence in
 * boxManager.getBoxApiKey() — the stored value set via /setapikey wins over the
 * UPSTASH_BOX_API_KEY env var — so what's shown is what actually reaches the
 * Box API. Use /botconfig for the masked view.
 */
export async function showApiKeyCommand(ctx: BotContext): Promise<void> {
  const stored = await getConfigValue("UPSTASH_BOX_API_KEY", "");
  const key = stored || config.upstashBoxApiKey;

  if (!key) {
    await ctx.reply(
      fmtError("No Box API key set. Use /setapikey &lt;key&gt; to set one."),
      { parse_mode: "HTML" },
    );
    return;
  }

  const lines = [
    "<b>🔑 Upstash Box API Key</b>",
    "",
    `<code>${escapeHtml(key)}</code>`,
    "",
    `<i>Source: ${stored ? "set via /setapikey" : "environment"}</i>`,
  ];

  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
}

export async function setAgentKeyCommand(ctx: BotContext): Promise<void> {
  const key = ctx.match?.toString().trim();
  if (!key) {
    await ctx.reply(fmtError("Usage: /setagentkey &lt;key&gt;"), {
      parse_mode: "HTML",
    });
    return;
  }
  await setConfigValue("AGENT_API_KEY", key);
  try {
    await ctx.deleteMessage();
  } catch {
    /* may fail in groups */
  }
  await ctx.reply(fmtSuccess("Agent API key updated"), { parse_mode: "HTML" });
}

export async function addUserCommand(ctx: BotContext): Promise<void> {
  const userId = ctx.match?.toString().trim();
  if (!userId || !/^\d+$/.test(userId)) {
    await ctx.reply(fmtError("Usage: /adduser &lt;telegram-id&gt;"), {
      parse_mode: "HTML",
    });
    return;
  }

  const current = await getConfigValue("ALLOWED_USERS", "");
  const ids = new Set(
    current
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  ids.add(userId);
  await setConfigValue("ALLOWED_USERS", [...ids].join(","));

  await ctx.reply(fmtSuccess(`User <code>${escapeHtml(userId)}</code> added`), {
    parse_mode: "HTML",
  });
}

export async function removeUserCommand(ctx: BotContext): Promise<void> {
  const userId = ctx.match?.toString().trim();
  if (!userId) {
    await ctx.reply(fmtError("Usage: /removeuser &lt;telegram-id&gt;"), {
      parse_mode: "HTML",
    });
    return;
  }

  const current = await getConfigValue("ALLOWED_USERS", "");
  const ids = new Set(
    current
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  ids.delete(userId);
  await setConfigValue("ALLOWED_USERS", [...ids].join(","));

  await ctx.reply(
    fmtSuccess(`User <code>${escapeHtml(userId)}</code> removed`),
    {
      parse_mode: "HTML",
    },
  );
}

export async function botConfigCommand(ctx: BotContext): Promise<void> {
  const boxKey = await getConfigValue(
    "UPSTASH_BOX_API_KEY",
    config.upstashBoxApiKey,
  );
  const agentKey = await getConfigValue("AGENT_API_KEY", config.agentApiKey);
  const allowedUsers = await getConfigValue("ALLOWED_USERS", "");

  const mask = (key: string) =>
    key ? `${key.slice(0, 6)}...${key.slice(-4)}` : "not set";

  const lines = [
    "<b>🧬 MedusaXD Claude Bot Config</b>",
    "",
    `<b>Box API Key:</b> <code>${escapeHtml(mask(boxKey))}</code>`,
    `<b>Agent Key:</b> <code>${escapeHtml(mask(agentKey))}</code>`,
    `<b>Admin IDs:</b> <code>${escapeHtml(config.adminTelegramIds.join(", ") || "none")}</code>`,
    `<b>Allowed Users:</b> <code>${escapeHtml(allowedUsers || "none")}</code>`,
    `<b>Bot Mode:</b> ${config.botMode}`,
  ];

  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
}
