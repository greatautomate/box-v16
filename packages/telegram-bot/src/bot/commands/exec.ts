import type { BotContext } from "../middleware/session.js";
import * as boxManager from "../../services/box-manager.js";
import {
  fmtError,
  fmtCode,
  fmtSuccess,
  escapeHtml,
} from "../../services/format.js";
import { InputFile } from "grammy";

export async function execCommand(ctx: BotContext): Promise<void> {
  const command = ctx.match?.toString().trim();
  if (!command) {
    await ctx.reply(fmtError("Usage: /exec &lt;command&gt;"), {
      parse_mode: "HTML",
    });
    return;
  }

  const boxId = ctx.session?.activeBoxId;
  if (!boxId) {
    await ctx.reply(fmtError("No active server. Use /connect first."), {
      parse_mode: "HTML",
    });
    return;
  }

  try {
    const box = await boxManager.getBox(boxId);
    const run = await box.exec.command(command);
    const output = run.result || "(no output)";

    if (output.length > 3500) {
      // Send as document if too long
      const buffer = Buffer.from(output, "utf-8");
      await ctx.replyWithDocument(new InputFile(buffer, "output.txt"), {
        caption: `<code>$ ${escapeHtml(command)}</code>\nExit code: ${run.exitCode}`,
        parse_mode: "HTML",
      });
    } else {
      await ctx.reply(
        `<code>$ ${escapeHtml(command)}</code>\n${fmtCode(output)}\nExit: ${run.exitCode}`,
        { parse_mode: "HTML" },
      );
    }
  } catch (e) {
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
  }
}

export async function codeCommand(ctx: BotContext): Promise<void> {
  const args = ctx.match?.toString().trim() ?? "";
  const spaceIdx = args.indexOf(" ");
  if (spaceIdx === -1) {
    await ctx.reply(
      fmtError(
        "Usage: /code &lt;lang&gt; &lt;code&gt;\nExample: /code js console.log(1+1)",
      ),
      {
        parse_mode: "HTML",
      },
    );
    return;
  }

  const lang = args.slice(0, spaceIdx) as "js" | "ts" | "python";
  const code = args.slice(spaceIdx + 1);

  const boxId = ctx.session?.activeBoxId;
  if (!boxId) {
    await ctx.reply(fmtError("No active server. Use /connect first."), {
      parse_mode: "HTML",
    });
    return;
  }

  try {
    const box = await boxManager.getBox(boxId);
    const run = await box.exec.code({ code, lang });
    const output = run.result || "(no output)";

    await ctx.reply(fmtCode(output, lang), { parse_mode: "HTML" });
  } catch (e) {
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
  }
}

export async function previewCommand(ctx: BotContext): Promise<void> {
  const args = ctx.match?.toString().trim() ?? "";
  const parts = args.split(/\s+/);
  const port = parseInt(parts[0] ?? "", 10);

  if (isNaN(port) || port < 1 || port > 65535) {
    await ctx.reply(
      fmtError("Usage: /preview &lt;port&gt; [auth] — port must be 1-65535"),
      {
        parse_mode: "HTML",
      },
    );
    return;
  }

  const boxId = ctx.session?.activeBoxId;
  if (!boxId) {
    await ctx.reply(fmtError("No active server. Use /connect first."), {
      parse_mode: "HTML",
    });
    return;
  }

  try {
    const box = await boxManager.getBox(boxId);
    const useAuth = parts[1] === "auth";
    const preview = useAuth
      ? await box.getPreviewUrl(port, { bearerToken: true })
      : await box.getPreviewUrl(port);

    let text = `<b>🌐 Preview URL</b>\n<a href="${escapeHtml(preview.url)}">${escapeHtml(preview.url)}</a>`;
    if ("token" in preview && preview.token) {
      text += `\n<b>Token:</b> <code>${escapeHtml(preview.token)}</code>`;
    }

    await ctx.reply(text, { parse_mode: "HTML" });
  } catch (e) {
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
  }
}

export async function previewsCommand(ctx: BotContext): Promise<void> {
  const boxId = ctx.session?.activeBoxId;
  if (!boxId) {
    await ctx.reply(fmtError("No active server. Use /connect first."), {
      parse_mode: "HTML",
    });
    return;
  }

  try {
    const box = await boxManager.getBox(boxId);
    const { previews } = await box.listPreviews();

    if (previews.length === 0) {
      await ctx.reply("No active preview URLs.", { parse_mode: "HTML" });
      return;
    }

    const lines = previews.map(
      (p) =>
        `Port ${p.port}: <a href="${escapeHtml(p.url)}">${escapeHtml(p.url)}</a>`,
    );
    await ctx.reply(`<b>🌐 Active Previews</b>\n\n${lines.join("\n")}`, {
      parse_mode: "HTML",
    });
  } catch (e) {
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
  }
}
