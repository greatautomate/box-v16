import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { CustomFile } from "telegram/client/uploads.js";
import { config } from "../config.js";

const MAX_MTPROTO_UPLOAD = 2 * 1024 * 1024 * 1024; // 2 GB (non-premium)

let client: TelegramClient | null = null;
let connectPromise: Promise<TelegramClient> | null = null;

/** True if MTProto credentials are configured. */
export function isEnabled(): boolean {
  return (
    config.telegramApiId > 0 &&
    config.telegramApiHash.length > 0 &&
    config.telegramUserSession.length > 0
  );
}

export const MTPROTO_MAX_UPLOAD = MAX_MTPROTO_UPLOAD;

async function getClient(): Promise<TelegramClient> {
  if (client && client.connected) return client;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    const session = new StringSession(config.telegramUserSession);
    const c = new TelegramClient(
      session,
      config.telegramApiId,
      config.telegramApiHash,
      {
        connectionRetries: 5,
        useWSS: true,
      },
    );
    await c.connect();
    const me = await c.getMe().catch(() => null);
    if (!me) {
      throw new Error(
        "MTProto session is invalid or unauthorized — regenerate with scripts/generate-session.ts",
      );
    }
    client = c;
    return c;
  })();

  try {
    return await connectPromise;
  } finally {
    connectPromise = null;
  }
}

/**
 * Send a buffer as a Telegram document via MTProto. Bypasses the 50 MB
 * Bot API limit; capped at 2 GB (4 GB with Premium).
 */
export async function sendDocument(
  chatId: number | string,
  buffer: Buffer,
  fileName: string,
  caption?: string,
): Promise<void> {
  if (!isEnabled()) {
    throw new Error(
      "MTProto uploader not configured — set TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_USER_SESSION",
    );
  }
  if (buffer.length > MAX_MTPROTO_UPLOAD) {
    throw new Error(
      `File is ${(buffer.length / 1024 / 1024 / 1024).toFixed(2)} GB — exceeds the 2 GB MTProto limit`,
    );
  }

  const c = await getClient();
  const file = new CustomFile(fileName, buffer.length, "", buffer);
  await c.sendFile(chatId, {
    file,
    forceDocument: true,
    caption,
    parseMode: "html",
    workers: 4,
  });
}

/** Gracefully disconnect the MTProto client (call on shutdown). */
export async function disconnect(): Promise<void> {
  if (client) {
    await client.disconnect().catch(() => {});
    client = null;
  }
}
