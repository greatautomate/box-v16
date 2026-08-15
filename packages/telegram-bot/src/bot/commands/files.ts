import type { BotContext } from "../middleware/session.js";
import * as boxManager from "../../services/box-manager.js";
import {
  uploadFileToBox,
  zipAndSend,
  parseZipArgs,
  safePath,
} from "../../services/file-handler.js";
import * as mtproto from "../../services/mtproto-uploader.js";
import { updateSession } from "../../services/session-store.js";
import {
  fmtError,
  fmtSuccess,
  fmtPath,
  escapeHtml,
} from "../../services/format.js";
import { InputFile } from "grammy";

const MAX_BOT_API_UPLOAD = 50 * 1024 * 1024; // 50 MB

export async function documentHandler(ctx: BotContext): Promise<void> {
  const boxId = ctx.session?.activeBoxId;
  if (!boxId) {
    await ctx.reply(
      fmtError("No active server. Use /connect first to upload files."),
      {
        parse_mode: "HTML",
      },
    );
    return;
  }

  const doc = ctx.message?.document;
  const photo = ctx.message?.photo;

  let fileId: string;
  let fileName: string;

  if (doc) {
    fileId = doc.file_id;
    fileName = doc.file_name ?? "file";
  } else if (photo && photo.length > 0) {
    const largest = photo[photo.length - 1]!;
    fileId = largest.file_id;
    fileName = "photo.jpg";
  } else {
    return;
  }

  const dest = ctx.session.uploadDestination;
  const userId = ctx.from!.id.toString();
  try {
    const box = await boxManager.getBox(boxId);
    await uploadFileToBox(ctx, box, fileId, fileName, dest);
  } catch (e) {
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
  } finally {
    // Always clear pending upload destination so a failed upload doesn't
    // redirect the user's next file to a stale location.
    if (dest) {
      await updateSession(userId, { uploadDestination: null });
    }
  }
}

export async function uploadCommand(ctx: BotContext): Promise<void> {
  const dest = ctx.match?.toString().trim();
  if (!dest) {
    await ctx.reply(
      "Send me a file and I'll upload it to <code>/workspace/home/</code>.\nOr use <code>/upload src/config/</code> to set a custom destination.",
      { parse_mode: "HTML" },
    );
    return;
  }

  const userId = ctx.from!.id.toString();
  await updateSession(userId, { uploadDestination: dest });
  await ctx.reply(
    fmtSuccess(`Next file you send will go to ${fmtPath(dest)}`),
    { parse_mode: "HTML" },
  );
}

export async function downloadCommand(ctx: BotContext): Promise<void> {
  const path = ctx.match?.toString().trim();
  if (!path) {
    await ctx.reply(fmtError("Usage: /download &lt;path&gt;"), {
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
    const resolved = safePath(path);
    const base64 = await box.files.read(resolved, { encoding: "base64" });
    const buffer = Buffer.from(base64, "base64");
    const fileName = resolved.split("/").pop() ?? "file";

    if (buffer.length > MAX_BOT_API_UPLOAD) {
      if (!mtproto.isEnabled()) {
        await ctx.reply(
          fmtError(
            `File is ${(buffer.length / 1024 / 1024).toFixed(1)} MB — exceeds Bot API's 50 MB limit. Configure TELEGRAM_API_ID/HASH/USER_SESSION to enable up to 2 GB.`,
          ),
          { parse_mode: "HTML" },
        );
        return;
      }
      await mtproto.sendDocument(ctx.chat!.id, buffer, fileName);
    } else {
      await ctx.replyWithDocument(new InputFile(buffer, fileName));
    }
  } catch (e) {
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
  }
}

export async function zipCommand(ctx: BotContext): Promise<void> {
  const boxId = ctx.session?.activeBoxId;
  if (!boxId) {
    await ctx.reply(fmtError("No active server. Use /connect first."), {
      parse_mode: "HTML",
    });
    return;
  }

  const args = ctx.match?.toString() ?? "";
  const parsed = parseZipArgs(args);

  if (parsed.mode === "help") {
    await ctx.reply(
      [
        "<b>Usage:</b>",
        "<code>/zip</code> — zip entire project",
        "<code>/zip src/</code> — zip a folder",
        "<code>/zip file1.ts file2.ts</code> — zip specific files",
        "<code>/zip the whole project</code> — also works!",
      ].join("\n"),
      { parse_mode: "HTML" },
    );
    return;
  }

  await ctx.reply("<i>🗜 Zipping...</i>", { parse_mode: "HTML" });

  try {
    const box = await boxManager.getBox(boxId);
    await zipAndSend(ctx, box, parsed.paths);
  } catch (e) {
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
  }
}

export async function lsCommand(ctx: BotContext): Promise<void> {
  const boxId = ctx.session?.activeBoxId;
  if (!boxId) {
    await ctx.reply(fmtError("No active server. Use /connect first."), {
      parse_mode: "HTML",
    });
    return;
  }

  const rawPath = ctx.match?.toString().trim() || undefined;

  try {
    const box = await boxManager.getBox(boxId);
    const files = await box.files.list(rawPath ? safePath(rawPath) : undefined);

    if (files.length === 0) {
      await ctx.reply("Empty directory.", { parse_mode: "HTML" });
      return;
    }

    const lines = files.map(
      (f: { is_dir: boolean; name: string }) =>
        `${f.is_dir ? "📂" : "📄"} ${escapeHtml(f.name)}`,
    );
    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
  } catch (e) {
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
  }
}
