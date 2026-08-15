import type { BotContext } from "../middleware/session.js";
import * as boxManager from "../../services/box-manager.js";
import { withBoxLock, tryAcquire, release } from "../../services/run-lock.js";
import { config, boxWebhookUrl } from "../../config.js";
import {
  fmtError,
  fmtToolUse,
  fmtCost,
  splitMessage,
  escapeHtml,
  mdToTelegramHtml,
} from "../../services/format.js";

/** Max time a detached (/task) run holds the box lock before auto-releasing. */
const TASK_LOCK_TTL_MS = 30 * 60_000; // 30 minutes

/** Reply sent when a run is already in progress for the active box. */
const BUSY_MESSAGE = fmtError(
  "⏳ A task is already running on this server. Wait for it to finish, or /connect a different one.",
);

/** Pick a human-readable preview of a tool's input. */
function summarizeToolInput(
  input: Record<string, unknown> | undefined,
): string | undefined {
  if (!input) return undefined;
  const preferredKeys = [
    "command",
    "file_path",
    "path",
    "pattern",
    "url",
    "query",
  ];
  let value: unknown;
  for (const k of preferredKeys) {
    if (input[k] !== undefined) {
      value = input[k];
      break;
    }
  }
  if (value === undefined) value = Object.values(input)[0];
  if (value === undefined) return undefined;
  const str = typeof value === "string" ? value : JSON.stringify(value);
  const oneLine = str.replace(/\s+/g, " ").trim();
  return oneLine.length > 120 ? `${oneLine.slice(0, 120)}…` : oneLine;
}

/** Require an active server or reply with error. Returns box ID or null. */
function requireBox(ctx: BotContext): string | null {
  const boxId = ctx.session?.activeBoxId;
  if (!boxId) {
    void ctx.reply(
      fmtError("No active server. Use /connect or /create first."),
      {
        parse_mode: "HTML",
      },
    );
    return null;
  }
  return boxId;
}

/**
 * Show a "typing…" chat action and keep refreshing it until the returned stop
 * function is called. Telegram expires a chat action after ~5s, so we re-send
 * it on an interval to keep the indicator visible for the whole run.
 */
function startTyping(ctx: BotContext): () => void {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return () => {};
  const send = (): void => {
    void ctx.api.sendChatAction(chatId, "typing").catch(() => {});
  };
  send();
  const timer = setInterval(send, 4500);
  return () => clearInterval(timer);
}

export async function promptCommand(ctx: BotContext): Promise<void> {
  const prompt = ctx.match?.toString().trim();
  if (!prompt) {
    await ctx.reply(fmtError("Usage: /prompt &lt;text&gt;"), {
      parse_mode: "HTML",
    });
    return;
  }
  await runPrompt(ctx, prompt);
}

export async function streamCommand(ctx: BotContext): Promise<void> {
  const prompt = ctx.match?.toString().trim();
  if (!prompt) {
    await ctx.reply(fmtError("Usage: /stream &lt;text&gt;"), {
      parse_mode: "HTML",
    });
    return;
  }
  await runStream(ctx, prompt);
}

/**
 * Fire a detached agent run that completes asynchronously and notifies the user
 * via the box → bot webhook, instead of blocking like /prompt and /stream. Good
 * for long tasks the user doesn't want to babysit.
 */
export async function taskCommand(ctx: BotContext): Promise<void> {
  const prompt = ctx.match?.toString().trim();
  if (!prompt) {
    await ctx.reply(fmtError("Usage: /task &lt;text&gt;"), {
      parse_mode: "HTML",
    });
    return;
  }

  const boxId = requireBox(ctx);
  if (!boxId) return;

  const callbackUrl = boxWebhookUrl();
  if (!callbackUrl) {
    await ctx.reply(
      fmtError(
        "Async tasks require webhook mode with BOX_WEBHOOK_SECRET set. Use /prompt or /stream instead.",
      ),
      { parse_mode: "HTML" },
    );
    return;
  }

  // Reserve the box for the whole detached run; the completion webhook (or the
  // TTL safety net) releases it. A concurrent /prompt or /task is rejected
  // while it's held.
  if (!tryAcquire(boxId, TASK_LOCK_TTL_MS)) {
    await ctx.reply(BUSY_MESSAGE, { parse_mode: "HTML" });
    return;
  }

  try {
    const box = await boxManager.getBox(boxId);
    // Fire-and-forget: the SDK registers the webhook and returns immediately.
    await box.agent.run({
      prompt,
      webhook: {
        url: callbackUrl,
        headers: { "x-box-webhook-secret": config.boxWebhookSecret },
      },
    });
  } catch (e) {
    release(boxId);
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
    return;
  }

  const serverName = await boxManager.getBoxName(boxId);
  await ctx.reply(
    `<b>🚀 Task started on ${escapeHtml(serverName)}</b>\nI'll message you here when it finishes.`,
    { parse_mode: "HTML" },
  );
}

/** Handle direct messages (no command prefix) as prompts when a box is active. */
export async function directMessageHandler(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text || !ctx.session?.activeBoxId) return;
  await runPrompt(ctx, text);
}

/** Run a prompt using box.agent.run() — collects full output then replies. */
async function runPrompt(ctx: BotContext, prompt: string): Promise<void> {
  const boxId = requireBox(ctx);
  if (!boxId) return;

  // Serialize runs per box: a second prompt while one is in flight would race
  // the agent's server-side conversation state, so reject instead.
  const result = await withBoxLock(boxId, async () => {
    const statusMsg = await ctx.reply("<i>⏳ Thinking...</i>", {
      parse_mode: "HTML",
      reply_to_message_id: ctx.message?.message_id,
    });
    const stopTyping = startTyping(ctx);

    try {
      const box = await boxManager.getBox(boxId);
      const run = await box.agent.run({
        prompt,
        onToolUse: (tool) => {
          void ctx.api
            .editMessageText(
              ctx.chat!.id,
              statusMsg.message_id,
              `<i>⏳ ${fmtToolUse(tool.name, summarizeToolInput(tool.input))}</i>`,
              { parse_mode: "HTML" },
            )
            .catch((err) => {
              console.warn("Failed to update tool-use status:", err);
            });
        },
      });

      // Delete the "Thinking..." message
      await ctx.api
        .deleteMessage(ctx.chat!.id, statusMsg.message_id)
        .catch(() => {});

      // Send the result
      const output = run.result || "(no output)";
      const chunks = splitMessage(mdToTelegramHtml(output));

      for (const chunk of chunks) {
        await ctx.reply(chunk, {
          parse_mode: "HTML",
          reply_to_message_id: ctx.message?.message_id,
        });
      }

      // Cost footer
      if (run.cost.inputTokens > 0) {
        const serverName = await boxManager.getBoxName(boxId);
        await ctx.reply(
          fmtCost(
            run.cost.inputTokens,
            run.cost.outputTokens,
            run.cost.totalUsd,
            serverName,
          ),
          { parse_mode: "HTML" },
        );
      }
    } catch (e) {
      await ctx.api
        .deleteMessage(ctx.chat!.id, statusMsg.message_id)
        .catch(() => {});
      await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
        parse_mode: "HTML",
      });
    } finally {
      stopTyping();
    }
  });

  if (!result.ran) {
    await ctx.reply(BUSY_MESSAGE, { parse_mode: "HTML" });
  }
}

/** Run a prompt using box.agent.stream() — edits message in real-time. */
async function runStream(ctx: BotContext, prompt: string): Promise<void> {
  const boxId = requireBox(ctx);
  if (!boxId) return;

  // Serialize runs per box (see runPrompt): reject a concurrent stream rather
  // than let two runs interleave the agent's conversation state.
  const result = await withBoxLock(boxId, async () => {
    const msg = await ctx.reply("<i>⏳ Streaming...</i>", {
      parse_mode: "HTML",
      reply_to_message_id: ctx.message?.message_id,
    });
    const stopTyping = startTyping(ctx);

    try {
      const box = await boxManager.getBox(boxId);
      const stream = await box.agent.stream({ prompt });

      let accumulated = "";
      let lastEditAt = 0;
      const EDIT_INTERVAL = 500;

      for await (const chunk of stream) {
        if (chunk.type === "text-delta") {
          accumulated += chunk.text;
        } else if (chunk.type === "tool-call") {
          accumulated += `\n${fmtToolUse(chunk.toolName)}\n`;
        }

        const now = Date.now();
        if (now - lastEditAt > EDIT_INTERVAL && accumulated.length > 0) {
          const display =
            accumulated.length > 4000 ? accumulated.slice(-4000) : accumulated;
          await ctx.api
            .editMessageText(
              ctx.chat!.id,
              msg.message_id,
              escapeHtml(display),
              {
                parse_mode: "HTML",
              },
            )
            .catch(() => {});
          lastEditAt = now;
        }
      }

      // Final edit with full output
      const final = accumulated || "(no output)";
      const chunks = splitMessage(mdToTelegramHtml(final));
      await ctx.api
        .editMessageText(ctx.chat!.id, msg.message_id, chunks[0]!, {
          parse_mode: "HTML",
        })
        .catch(() => {});

      // Send overflow chunks as new messages
      for (let i = 1; i < chunks.length; i++) {
        await ctx.reply(chunks[i]!, { parse_mode: "HTML" });
      }

      // Cost footer
      if (stream.cost.inputTokens > 0) {
        const serverName = await boxManager.getBoxName(boxId);
        await ctx.reply(
          fmtCost(
            stream.cost.inputTokens,
            stream.cost.outputTokens,
            stream.cost.totalUsd,
            serverName,
          ),
          { parse_mode: "HTML" },
        );
      }
    } catch (e) {
      await ctx.api
        .editMessageText(
          ctx.chat!.id,
          msg.message_id,
          fmtError(e instanceof Error ? e.message : String(e)),
          { parse_mode: "HTML" },
        )
        .catch(() => {});
    } finally {
      stopTyping();
    }
  });

  if (!result.ran) {
    await ctx.reply(BUSY_MESSAGE, { parse_mode: "HTML" });
  }
}

export async function newchatCommand(ctx: BotContext): Promise<void> {
  const boxId = requireBox(ctx);
  if (!boxId) return;

  // The Box SDK exposes no API to clear an agent's server-side conversation
  // state, so we can't truthfully claim a reset. Tell the user how to actually
  // get a clean slate instead of silently doing nothing.
  await ctx.reply(
    [
      "<b>ℹ️ Conversation memory lives on the server.</b>",
      "",
      "This bot can't clear it remotely. For a fresh start, use <code>/create</code> to spin up a new server, then <code>/connect</code> to it.",
    ].join("\n"),
    { parse_mode: "HTML" },
  );
}

export async function historyCommand(ctx: BotContext): Promise<void> {
  const boxId = requireBox(ctx);
  if (!boxId) return;

  try {
    const box = await boxManager.getBox(boxId);
    const runs = await box.listRuns();
    if (runs.length === 0) {
      await ctx.reply("No runs yet.", { parse_mode: "HTML" });
      return;
    }

    const lines = runs.slice(0, 10).map((r, i) => {
      const prompt = r.prompt ? escapeHtml(r.prompt.slice(0, 60)) : "—";
      const cost = r.cost_usd > 0 ? ` ($${r.cost_usd.toFixed(4)})` : "";
      return `${i + 1}. <b>${r.status}</b> — ${prompt}${cost}`;
    });

    await ctx.reply(`<b>📜 Recent Runs</b>\n\n${lines.join("\n")}`, {
      parse_mode: "HTML",
    });
  } catch (e) {
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
  }
}
