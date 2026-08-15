import "dotenv/config";
import { config, BOT_NAME, mtprotoEnabled } from "./config.js";
import { connectDB } from "./db/index.js";
import { createBot } from "./bot/index.js";
import { createWebRouter } from "./web/routes.js";
import { handleBoxWebhook } from "./services/box-notify.js";
import * as mtproto from "./services/mtproto-uploader.js";
import express from "express";
// @ts-ignore -- cookie-parser types may not be installed
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import path from "node:path";

async function main(): Promise<void> {
  console.log(`🧬 ${BOT_NAME} starting...`);

  // 0. Startup checks
  if (!config.telegramBotToken)
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  if (!config.jwtSecret)
    throw new Error("JWT_SECRET is required (used to sign admin auth tokens)");
  if (config.adminTelegramIds.length === 0) {
    console.warn(
      config.allowAllUsers
        ? "⚠️ ADMIN_TELEGRAM_IDS is not set and ALLOW_ALL_USERS=true — bot is OPEN to all users"
        : "⚠️ ADMIN_TELEGRAM_IDS is not set — bot will DENY all users until configured (set ALLOW_ALL_USERS=true for an open dev bot)",
    );
  }
  if (config.botMode === "webhook" && !config.webhookUrl) {
    throw new Error("WEBHOOK_URL is required when BOT_MODE=webhook");
  }
  if (config.botMode === "webhook" && !config.adminPassword) {
    console.warn(
      "⚠️ ADMIN_PASSWORD is not set — the web admin panel cannot be logged into.",
    );
  }
  if (config.botMode === "webhook" && !config.webhookSecret) {
    console.warn(
      "⚠️ WEBHOOK_SECRET is not set — Telegram webhook requests are not authenticated. Set it to reject forged updates.",
    );
  }
  console.log(`📋 Bot mode: ${config.botMode}`);
  console.log(
    `📋 Admin IDs: ${config.adminTelegramIds.join(", ") || "(none)"}`,
  );
  console.log(
    `📋 MTProto: ${mtprotoEnabled() ? "enabled (up to 2 GB)" : "disabled (Bot API 50 MB cap)"}`,
  );
  if (config.botMode === "webhook")
    console.log(`📋 Webhook: ${config.webhookUrl}`);

  // Graceful shutdown of MTProto client (no-op when disabled)
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.once(sig, () => {
      void mtproto.disconnect();
    });
  }

  // 1. Connect to MongoDB
  await connectDB();

  // 2. Create bot
  const bot = createBot();

  // 3. Start based on BOT_MODE
  if (config.botMode === "webhook") {
    if (!config.webhookUrl) {
      throw new Error("WEBHOOK_URL is required when BOT_MODE=webhook");
    }

    // bot.handleUpdate requires botInfo. webhookCallback used to call
    // init() lazily on first request; we ack the webhook ourselves now,
    // so we must init explicitly before listening.
    await bot.init();

    const app = createExpressApp(bot);

    app.listen(config.port, () => {
      console.log(`🌐 Web server listening on port ${config.port}`);
    });

    // Register webhook with Telegram. drop_pending_updates discards any
    // messages Telegram queued while the bot was down between deploys, so
    // we don't replay stale chats ahead of the user's current message.
    // secret_token is echoed back on every request so we can reject forgeries.
    await bot.api.setWebhook(config.webhookUrl, {
      drop_pending_updates: true,
      ...(config.webhookSecret ? { secret_token: config.webhookSecret } : {}),
    });
    console.log(`🔗 Webhook registered: ${config.webhookUrl}`);
  } else {
    // Polling mode — also start web admin server
    const app = createExpressApp(bot);
    app.listen(config.port, () => {
      console.log(`🌐 Web admin on port ${config.port}`);
    });

    console.log("📡 Starting in polling mode...");
    await bot.start({
      drop_pending_updates: true,
      onStart: () => console.log(`✅ ${BOT_NAME} is running (polling)`),
    });
  }
}

/** Create the Express app with all routes. */
function createExpressApp(bot: ReturnType<typeof createBot>): express.Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Telegram webhook endpoint. We ack immediately (200) and process the
  // update asynchronously — otherwise Telegram's ~60s timeout causes it to
  // retry the same update 2-4 times, which spawns duplicate agent runs.
  app.post("/api/webhook", (req, res) => {
    // Reject forged updates: Telegram echoes our secret on every request.
    if (
      config.webhookSecret &&
      req.get("x-telegram-bot-api-secret-token") !== config.webhookSecret
    ) {
      res.sendStatus(401);
      return;
    }
    res.sendStatus(200);
    bot.handleUpdate(req.body).catch((err) => {
      console.error("Update handler error:", err);
    });
  });

  // Box → bot notification webhook. Disabled unless a shared secret is set,
  // and every request must present it (avoids an open, unauthenticated endpoint).
  // Fires when a detached /task run completes; we ack immediately and DM the
  // box owner the result asynchronously.
  app.post("/api/webhook/box", (req, res) => {
    if (!config.boxWebhookSecret) {
      res.sendStatus(404);
      return;
    }
    if (req.get("x-box-webhook-secret") !== config.boxWebhookSecret) {
      res.sendStatus(401);
      return;
    }
    res.json({ ok: true });
    handleBoxWebhook(bot.api, req.body).catch((err) => {
      console.error("Box webhook handler error:", err);
    });
  });

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", bot: BOT_NAME });
  });

  // Web admin API
  app.use("/api", createWebRouter());

  // Static frontend
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const publicDir = path.join(__dirname, "web", "public");
  app.use(express.static(publicDir));

  return app;
}

main().catch((err) => {
  console.error("❌ Fatal error:", err instanceof Error ? err.message : err);
  console.error("\nChecklist:");
  console.error(
    "  - TELEGRAM_BOT_TOKEN set?",
    config.telegramBotToken ? "yes" : "NO ← missing",
  );
  console.error(
    "  - MONGODB_URI set?",
    config.mongodbUri ? "yes" : "NO ← missing",
  );
  console.error(
    "  - ADMIN_TELEGRAM_IDS set?",
    config.adminTelegramIds.length > 0 ? "yes" : "NO ← missing",
  );
  process.exit(1);
});
