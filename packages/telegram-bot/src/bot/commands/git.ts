import type { BotContext } from "../middleware/session.js";
import * as boxManager from "../../services/box-manager.js";
import {
  fmtError,
  fmtSuccess,
  fmtCode,
  escapeHtml,
} from "../../services/format.js";
import { InputFile } from "grammy";

export async function cloneCommand(ctx: BotContext): Promise<void> {
  const args = ctx.match?.toString().trim() ?? "";
  const [repo, branch] = args.split(/\s+/);
  if (!repo) {
    await ctx.reply(fmtError("Usage: /clone &lt;repo&gt; [branch]"), {
      parse_mode: "HTML",
    });
    return;
  }

  const boxId = ctx.session?.activeBoxId;
  if (!boxId) {
    await ctx.reply(fmtError("No active server."), { parse_mode: "HTML" });
    return;
  }

  try {
    const box = await boxManager.getBox(boxId);
    await box.git.clone({ repo, branch });
    await ctx.reply(fmtSuccess(`Cloned ${escapeHtml(repo)}`), {
      parse_mode: "HTML",
    });
  } catch (e) {
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
  }
}

export async function diffCommand(ctx: BotContext): Promise<void> {
  const boxId = ctx.session?.activeBoxId;
  if (!boxId) {
    await ctx.reply(fmtError("No active server."), { parse_mode: "HTML" });
    return;
  }

  try {
    const box = await boxManager.getBox(boxId);
    const diff = await box.git.diff();
    if (!diff) {
      await ctx.reply("No changes.", { parse_mode: "HTML" });
      return;
    }

    if (diff.length > 3500) {
      await ctx.replyWithDocument(
        new InputFile(Buffer.from(diff), "diff.patch"),
      );
    } else {
      await ctx.reply(fmtCode(diff, "diff"), { parse_mode: "HTML" });
    }
  } catch (e) {
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
  }
}

export async function commitCommand(ctx: BotContext): Promise<void> {
  const message = ctx.match?.toString().trim();
  if (!message) {
    await ctx.reply(fmtError("Usage: /commit &lt;message&gt;"), {
      parse_mode: "HTML",
    });
    return;
  }
  const boxId = ctx.session?.activeBoxId;
  if (!boxId) {
    await ctx.reply(fmtError("No active server."), { parse_mode: "HTML" });
    return;
  }

  try {
    const box = await boxManager.getBox(boxId);
    const { sha } = await box.git.commit({ message });
    await ctx.reply(
      fmtSuccess(`Committed: <code>${escapeHtml(sha.slice(0, 8))}</code>`),
      { parse_mode: "HTML" },
    );
  } catch (e) {
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
  }
}

export async function pushCommand(ctx: BotContext): Promise<void> {
  const branch = ctx.match?.toString().trim() || undefined;
  const boxId = ctx.session?.activeBoxId;
  if (!boxId) {
    await ctx.reply(fmtError("No active server."), { parse_mode: "HTML" });
    return;
  }

  try {
    const box = await boxManager.getBox(boxId);
    await box.git.push({ branch });
    await ctx.reply(
      fmtSuccess(`Pushed${branch ? ` to ${escapeHtml(branch)}` : ""}`),
      { parse_mode: "HTML" },
    );
  } catch (e) {
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
  }
}

export async function prCommand(ctx: BotContext): Promise<void> {
  const title = ctx.match?.toString().trim();
  if (!title) {
    await ctx.reply(fmtError("Usage: /pr &lt;title&gt;"), {
      parse_mode: "HTML",
    });
    return;
  }
  const boxId = ctx.session?.activeBoxId;
  if (!boxId) {
    await ctx.reply(fmtError("No active server."), { parse_mode: "HTML" });
    return;
  }

  try {
    const box = await boxManager.getBox(boxId);
    const pr = await box.git.createPR({ title });
    await ctx.reply(
      `${fmtSuccess("PR created")}\n<a href="${escapeHtml(pr.url)}">#${pr.number} ${escapeHtml(pr.title)}</a>`,
      { parse_mode: "HTML" },
    );
  } catch (e) {
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
  }
}
