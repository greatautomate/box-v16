import type { Context, NextFunction } from "grammy";
import { config } from "../../config.js";
import { getConfigValue } from "../../db/models/bot-config.js";

/** Get the full list of allowed Telegram IDs: env + DB-stored. */
async function getAllowedIds(): Promise<Set<string>> {
  const ids = new Set(config.adminTelegramIds);

  const dbList = await getConfigValue("ALLOWED_USERS", "");
  if (dbList) {
    for (const id of dbList
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)) {
      ids.add(id);
    }
  }

  return ids;
}

/** Check if a Telegram user ID is an admin (from env only). */
export function isAdmin(telegramId: string): boolean {
  return config.adminTelegramIds.includes(telegramId);
}

/** Middleware that blocks unauthorized users. */
export async function authMiddleware(
  ctx: Context,
  next: NextFunction,
): Promise<void> {
  const userId = ctx.from?.id?.toString();
  if (!userId) return;

  const allowed = await getAllowedIds();

  // Fail closed: with no allow-list configured, deny everyone unless the
  // operator has explicitly opted into an open bot via ALLOW_ALL_USERS=true.
  if (allowed.size === 0) {
    if (config.allowAllUsers) {
      console.warn(
        "⚠️ ALLOW_ALL_USERS=true and no ADMIN_TELEGRAM_IDS — allowing all users.",
      );
      await next();
      return;
    }
    console.warn(
      "🚫 No ADMIN_TELEGRAM_IDS configured — denying all users. Set ADMIN_TELEGRAM_IDS (or ALLOW_ALL_USERS=true for dev).",
    );
    await ctx.reply(
      "⛔ This bot is not configured yet. Ask the operator to set ADMIN_TELEGRAM_IDS.",
    );
    return;
  }

  if (allowed.has(userId)) {
    await next();
    return;
  }

  console.log(`🚫 Blocked user ${userId} (not in allowed list)`);
  await ctx.reply("⛔ You are not authorized to use this bot.");
}

/** Middleware that blocks non-admin users. */
export async function adminOnly(
  ctx: Context,
  next: NextFunction,
): Promise<void> {
  const userId = ctx.from?.id?.toString();
  if (!userId || !isAdmin(userId)) {
    await ctx.reply("⛔ This command is admin-only.");
    return;
  }
  await next();
}
