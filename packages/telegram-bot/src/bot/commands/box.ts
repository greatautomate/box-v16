import type { BotContext } from "../middleware/session.js";
import * as boxManager from "../../services/box-manager.js";
import { updateSession } from "../../services/session-store.js";
import {
  fmtSuccess,
  fmtError,
  fmtBoxInfo,
  escapeHtml,
} from "../../services/format.js";
import { boxListKeyboard } from "../keyboards/boxes.js";
import { runtimeKeyboard } from "../keyboards/models.js";
import {
  confirmKeyboard,
  boxActionKeyboard,
  mainMenuKeyboard,
} from "../keyboards/common.js";
import { BOT_NAME } from "../../config.js";

export async function startCommand(ctx: BotContext): Promise<void> {
  await ctx.reply(
    `<b>🧬 ${escapeHtml(BOT_NAME)}</b>\n\nWelcome to MedusaXD AI coding assistant.\nCreate Servers, prompt AI agents, manage files — all from Telegram. @medusaXD`,
    { parse_mode: "HTML", reply_markup: mainMenuKeyboard() },
  );
}

export async function createCommand(ctx: BotContext): Promise<void> {
  await ctx.reply("Select a runtime:", {
    parse_mode: "HTML",
    reply_markup: runtimeKeyboard(),
  });
}

export async function listCommand(ctx: BotContext): Promise<void> {
  try {
    const userId = ctx.from!.id.toString();
    const boxes = await boxManager.listBoxesForUser(userId);
    if (boxes.length === 0) {
      await ctx.reply("No servers found. Use /create to create one.", {
        parse_mode: "HTML",
      });
      return;
    }
    await ctx.reply(`<b>📋 Your Servers (${boxes.length})</b>`, {
      parse_mode: "HTML",
      reply_markup: boxListKeyboard(boxes),
    });
  } catch (e) {
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
  }
}

export async function connectCommand(ctx: BotContext): Promise<void> {
  const boxId = ctx.match?.toString().trim();
  if (!boxId) {
    await ctx.reply(fmtError("Usage: /connect &lt;box-id&gt;"), {
      parse_mode: "HTML",
    });
    return;
  }

  try {
    const userId = ctx.from!.id.toString();
    const box = await boxManager.getBox(boxId);
    await boxManager.assertBoxAccess(box.id, userId);
    await updateSession(userId, { activeBoxId: box.id });

    await ctx.reply(
      `${fmtSuccess("Connected to server")}\n${fmtBoxInfo({
        id: box.id,
        model: box.modelConfig.model,
      })}`,
      { parse_mode: "HTML", reply_markup: boxActionKeyboard(box.id) },
    );
  } catch (e) {
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
  }
}

export async function deleteCommand(ctx: BotContext): Promise<void> {
  const boxId = ctx.match?.toString().trim() || ctx.session?.activeBoxId;
  if (!boxId) {
    await ctx.reply(
      fmtError("Usage: /delete &lt;box-id&gt; or Connect to a server first"),
      {
        parse_mode: "HTML",
      },
    );
    return;
  }

  const userId = ctx.from!.id.toString();
  try {
    await boxManager.assertBoxAccess(boxId, userId);
  } catch (e) {
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
    return;
  }

  await ctx.reply(
    `Delete server <code>${escapeHtml(boxId)}</code>? This is irreversible.`,
    {
      parse_mode: "HTML",
      reply_markup: confirmKeyboard(`box:confirm-delete:${boxId}`),
    },
  );
}

export async function pauseCommand(ctx: BotContext): Promise<void> {
  const boxId = ctx.session?.activeBoxId;
  if (!boxId) {
    await ctx.reply(fmtError("No active server. Use /connect first."), {
      parse_mode: "HTML",
    });
    return;
  }
  try {
    await boxManager.assertBoxAccess(boxId, ctx.from!.id.toString());
    const box = await boxManager.getBox(boxId);
    await box.pause();
    await ctx.reply(fmtSuccess("Server paused"), { parse_mode: "HTML" });
  } catch (e) {
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
  }
}

export async function resumeCommand(ctx: BotContext): Promise<void> {
  const boxId = ctx.session?.activeBoxId;
  if (!boxId) {
    await ctx.reply(fmtError("No active server. Use /connect first."), {
      parse_mode: "HTML",
    });
    return;
  }
  try {
    await boxManager.assertBoxAccess(boxId, ctx.from!.id.toString());
    const box = await boxManager.getBox(boxId);
    await box.resume();
    await ctx.reply(fmtSuccess("Server resumed"), { parse_mode: "HTML" });
  } catch (e) {
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
  }
}

export async function statusCommand(ctx: BotContext): Promise<void> {
  const boxId = ctx.session?.activeBoxId;
  if (!boxId) {
    await ctx.reply(fmtError("No active server. Use /connect first."), {
      parse_mode: "HTML",
    });
    return;
  }
  try {
    await boxManager.assertBoxAccess(boxId, ctx.from!.id.toString());
    const box = await boxManager.getBox(boxId);
    const { status } = await box.getStatus();
    await ctx.reply(
      fmtBoxInfo({
        id: box.id,
        status,
        model: box.modelConfig.model,
      }),
      { parse_mode: "HTML", reply_markup: boxActionKeyboard(box.id) },
    );
  } catch (e) {
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
  }
}
