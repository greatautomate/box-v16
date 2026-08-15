import { z } from "zod";
import type { Api } from "grammy";
import * as boxManager from "./box-manager.js";
import { release } from "./run-lock.js";
import {
  fmtError,
  splitMessage,
  mdToTelegramHtml,
  escapeHtml,
} from "./format.js";

/**
 * Body a Box POSTs to /api/webhook/box when a detached agent run finishes.
 * Mirrors the SDK's WebhookPayload; validated because it is untrusted input.
 */
export const payloadSchema = z.object({
  box_id: z.string().min(1),
  status: z.enum(["completed", "failed"]),
  run_id: z.string().optional(),
  output: z.string().optional(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type BoxWebhookPayload = z.infer<typeof payloadSchema>;

/**
 * Handle a Box completion webhook: release the box's run lock and DM the owner
 * the result. Safe to call with unvalidated input — malformed bodies are
 * logged and ignored. Never throws (the HTTP layer has already acked).
 */
export async function handleBoxWebhook(api: Api, body: unknown): Promise<void> {
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    console.warn(
      "Ignoring malformed box webhook payload:",
      parsed.error.message,
    );
    return;
  }
  const payload = parsed.data;

  // The detached run held the box lock (see the /task command); free it now
  // that the run is done, regardless of who we end up notifying.
  release(payload.box_id);

  const ownerId = await boxManager.getBoxOwnerId(payload.box_id);
  if (!ownerId) {
    console.warn(
      `Box webhook for ${payload.box_id} has no recorded owner — nobody to notify.`,
    );
    return;
  }

  // For the bot's private-chat usage model, the owner's Telegram ID is their
  // chat ID.
  const chatId = Number(ownerId);
  const serverName = await boxManager.getBoxName(payload.box_id);

  const chunks = renderNotification(payload, serverName);
  for (const chunk of chunks) {
    await api
      .sendMessage(chatId, chunk, { parse_mode: "HTML" })
      .catch((err) =>
        console.error("Failed to deliver box notification:", err),
      );
  }
}

/** Build the Telegram message(s) for a completed/failed task. */
export function renderNotification(
  payload: BoxWebhookPayload,
  serverName: string,
): string[] {
  const header = `<b>${payload.status === "completed" ? "✅" : "❌"} Task ${payload.status} on ${escapeHtml(serverName)}</b>`;

  if (payload.status === "failed") {
    return splitMessage(
      `${header}\n${fmtError(payload.error || "Run failed.")}`,
    );
  }

  const body = payload.output?.trim()
    ? mdToTelegramHtml(payload.output)
    : "<i>(no output)</i>";
  return splitMessage(`${header}\n\n${body}`);
}
