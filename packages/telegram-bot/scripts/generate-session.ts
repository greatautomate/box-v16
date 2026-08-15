/**
 * One-time MTProto session generator.
 *
 * Run:
 *   pnpm --filter @medusaxd/claude-bot exec tsx scripts/generate-session.ts
 *
 * Prompts for your Telegram phone number, login code, and (if enabled) 2FA
 * password, then prints a StringSession to paste into the TELEGRAM_USER_SESSION
 * env var. Treat the output like a password — anyone with it can act as you on
 * Telegram.
 */
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";
import "dotenv/config";

async function main(): Promise<void> {
  const apiId = parseInt(process.env.TELEGRAM_API_ID ?? "", 10);
  const apiHash = process.env.TELEGRAM_API_HASH ?? "";
  if (!apiId || !apiHash) {
    console.error(
      "Set TELEGRAM_API_ID and TELEGRAM_API_HASH in your environment (get them from https://my.telegram.org)",
    );
    process.exit(1);
  }

  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () =>
      await input.text("Phone number (with country code): "),
    password: async () =>
      await input.text("2FA password (leave blank if none): "),
    phoneCode: async () => await input.text("Login code from Telegram: "),
    onError: (err) => console.error(err),
  });

  const session = (client.session as StringSession).save();
  console.log("\n=== TELEGRAM_USER_SESSION ===");
  console.log(session);
  console.log("=============================");
  console.log(
    "Paste this into your env as TELEGRAM_USER_SESSION. Do not share it.",
  );

  await client.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
