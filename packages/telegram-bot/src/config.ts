export const config = {
  // Bot
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  adminTelegramIds: (process.env.ADMIN_TELEGRAM_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
  // When no admin IDs are configured the bot denies everyone by default.
  // Set ALLOW_ALL_USERS=true to explicitly opt into an open bot (dev only).
  allowAllUsers:
    (process.env.ALLOW_ALL_USERS ?? "").trim().toLowerCase() === "true",

  // Database
  mongodbUri: process.env.MONGODB_URI ?? "",

  // Upstash Box
  upstashBoxApiKey: process.env.UPSTASH_BOX_API_KEY ?? "",
  agentApiKey: process.env.AGENT_API_KEY ?? "",

  // MTProto (optional; enables > 50 MB uploads via a user-account session)
  telegramApiId: parseInt(process.env.TELEGRAM_API_ID ?? "0", 10),
  telegramApiHash: process.env.TELEGRAM_API_HASH ?? "",
  telegramUserSession: process.env.TELEGRAM_USER_SESSION ?? "",

  // Web Admin
  adminUsername: process.env.ADMIN_USERNAME ?? "admin",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",

  // Deployment
  port: parseInt(process.env.PORT ?? "3000", 10),
  botMode: (process.env.BOT_MODE ?? "polling") as "polling" | "webhook",
  webhookUrl: process.env.WEBHOOK_URL ?? "",
  // Shared secret echoed by Telegram on each webhook request
  // (X-Telegram-Bot-Api-Secret-Token). When set, forged updates are rejected.
  webhookSecret: process.env.WEBHOOK_SECRET ?? "",
  // Shared secret required on the box → bot notification webhook.
  // When empty, /api/webhook/box is disabled.
  boxWebhookSecret: process.env.BOX_WEBHOOK_SECRET ?? "",
} as const;

export const BOT_NAME = "MedusaXD Claude Bot";

/** True when MTProto credentials are configured for large-file transfers. */
export function mtprotoEnabled(): boolean {
  return Boolean(
    config.telegramApiId &&
    config.telegramApiHash &&
    config.telegramUserSession,
  );
}

/**
 * Public URL a Box should POST to when a detached (async) agent run completes.
 * Derived from WEBHOOK_URL's origin. Returns null when async tasks can't be
 * offered — i.e. no public webhook origin, or no BOX_WEBHOOK_SECRET to
 * authenticate the callback (the /api/webhook/box endpoint is disabled without
 * it). When null, the /task command falls back to explaining it's unavailable.
 */
export function boxWebhookUrl(): string | null {
  if (!config.webhookUrl || !config.boxWebhookSecret) return null;
  try {
    return `${new URL(config.webhookUrl).origin}/api/webhook/box`;
  } catch {
    return null;
  }
}
