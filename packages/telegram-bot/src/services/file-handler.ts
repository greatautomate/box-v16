import type { Box } from "@upstash/box";
import type { Context } from "grammy";
import { InputFile } from "grammy";
import { fmtSuccess, fmtError, fmtPath, escapeHtml } from "./format.js";
import * as mtproto from "./mtproto-uploader.js";

const ARCHIVE_EXTENSIONS = [".zip", ".tar.gz", ".tgz", ".tar.bz2"];
const MAX_TELEGRAM_UPLOAD = 50 * 1024 * 1024; // 50 MB (Bot API)
const MAX_MTPROTO_UPLOAD = 2 * 1024 * 1024 * 1024; // 2 GB (user-session MTProto)
const WORKSPACE_ROOT = "/workspace/home";

const FILENAME_ALLOWED =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-";

function isArchive(filename: string): boolean {
  return ARCHIVE_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext));
}

/** Single-quote a string for safe use inside a POSIX shell command. */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/** Reduce an uploaded filename to a safe basename (no path segments, no shell metacharacters). */
function sanitizeFileName(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "";
  let cleaned = "";
  for (const ch of base) {
    cleaned += FILENAME_ALLOWED.includes(ch) ? ch : "_";
  }
  // Strip leading dots so we never produce a hidden/dot-relative name.
  while (cleaned.startsWith(".")) cleaned = cleaned.slice(1);
  return cleaned || "upload";
}

/** The archive type, derived from a (lowercased) filename. */
function archiveKind(filename: string): "zip" | "tar.gz" | "tar.bz2" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) return "tar.gz";
  if (lower.endsWith(".tar.bz2")) return "tar.bz2";
  return "zip";
}

function getExtractCommand(
  kind: "zip" | "tar.gz" | "tar.bz2",
  archivePath: string,
): string {
  const path = shellQuote(archivePath);
  const dest = shellQuote(WORKSPACE_ROOT);
  if (kind === "tar.gz") return `tar xzf ${path} -C ${dest}`;
  if (kind === "tar.bz2") return `tar xjf ${path} -C ${dest}`;
  return `unzip -o ${path} -d ${dest}`;
}

/** Coerce any user-supplied path into one under /workspace/home, resolving . and .. segments. */
export function safePath(input: string | null | undefined): string {
  if (!input) return WORKSPACE_ROOT;
  const cleaned = input.trim().replace(/\/+$/, "");
  if (!cleaned) return WORKSPACE_ROOT;
  const abs = cleaned.startsWith("/")
    ? cleaned
    : `${WORKSPACE_ROOT}/${cleaned}`;
  const parts: string[] = [];
  for (const seg of abs.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      if (parts.length > 0) parts.pop();
      continue;
    }
    parts.push(seg);
  }
  const normalized = `/${parts.join("/")}`;
  if (
    normalized === WORKSPACE_ROOT ||
    normalized.startsWith(`${WORKSPACE_ROOT}/`)
  ) {
    return normalized;
  }
  return WORKSPACE_ROOT;
}

function resolveDestPath(
  destination: string | null | undefined,
  fileName: string,
): string {
  return `${safePath(destination)}/${sanitizeFileName(fileName)}`;
}

/** Upload a Telegram file to the active server. Handles archive auto-extract. */
export async function uploadFileToBox(
  ctx: Context,
  box: Box,
  fileId: string,
  fileName: string,
  destination?: string | null,
): Promise<void> {
  const file = await ctx.api.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;

  const response = await fetch(url);
  const buffer = Buffer.from(await response.arrayBuffer());
  const base64 = buffer.toString("base64");

  if (isArchive(fileName)) {
    // Archive: upload inside workspace (sandbox blocks /tmp), extract, cleanup.
    // The temp path never embeds the raw user filename, so it cannot inject
    // shell metacharacters or path segments into the extract/cleanup commands.
    const safeName = sanitizeFileName(fileName);
    const archivePath = `${WORKSPACE_ROOT}/.upload-${Date.now()}-${safeName}`;
    await box.files.write({
      path: archivePath,
      content: base64,
      encoding: "base64",
    });

    const extractCmd = getExtractCommand(archiveKind(fileName), archivePath);
    const result = await box.exec.command(extractCmd);
    await box.exec.command(`rm -f ${shellQuote(archivePath)}`);

    if (result.exitCode !== 0) {
      await ctx.reply(fmtError(`Failed to extract: ${result.result}`), {
        parse_mode: "HTML",
      });
      return;
    }

    const files = await box.files.list();
    const tree = files
      .slice(0, 20)
      .map((f) => `${f.is_dir ? "📂" : "📄"} ${escapeHtml(f.name)}`)
      .join("\n");
    const extra =
      files.length > 20 ? `\n... and ${files.length - 20} more` : "";

    await ctx.reply(
      `${fmtSuccess(`Extracted ${escapeHtml(fileName)}`)}\n\n${tree}${extra}`,
      { parse_mode: "HTML" },
    );
  } else {
    // Regular file: upload directly
    const destPath = resolveDestPath(destination, fileName);
    await box.files.write({
      path: destPath,
      content: base64,
      encoding: "base64",
    });
    await ctx.reply(fmtSuccess(`Uploaded to ${fmtPath(destPath)}`), {
      parse_mode: "HTML",
    });
  }
}

/** Zip target path(s) inside the box and send as Telegram document. */
export async function zipAndSend(
  ctx: Context,
  box: Box,
  targets: string[],
  zipName = "project.zip",
): Promise<void> {
  const cleanTargets = targets.map((t) => t.trim()).filter(Boolean);
  const quotedTargets =
    cleanTargets.length > 0
      ? cleanTargets.map((t) => shellQuote(t)).join(" ")
      : ".";
  const zipPath = `${WORKSPACE_ROOT}/.export-${Date.now()}.zip`;

  // Create zip
  const zipResult = await box.exec.command(
    `zip -r ${shellQuote(zipPath)} ${quotedTargets}`,
  );
  if (zipResult.exitCode !== 0) {
    await ctx.reply(fmtError(`Zip failed: ${zipResult.result}`), {
      parse_mode: "HTML",
    });
    return;
  }

  // Check size
  const sizeResult = await box.exec.command(
    `stat -c %s ${shellQuote(zipPath)}`,
  );
  const sizeBytes = parseInt(sizeResult.result.trim(), 10);

  const overBotLimit = sizeBytes > MAX_TELEGRAM_UPLOAD;
  const overMtprotoLimit = sizeBytes > MAX_MTPROTO_UPLOAD;
  if (overMtprotoLimit || (overBotLimit && !mtproto.isEnabled())) {
    await box.exec.command(`rm ${shellQuote(zipPath)}`);
    const sizeMb = (sizeBytes / 1024 / 1024).toFixed(1);
    const hint = overMtprotoLimit
      ? "exceeds Telegram's 2 GB limit"
      : "exceeds Bot API's 50 MB limit — configure TELEGRAM_API_ID/HASH/USER_SESSION for up to 2 GB";
    await ctx.reply(
      fmtError(
        `Zip is ${sizeMb} MB — ${hint}. Try <code>/zip</code> on a smaller path.`,
      ),
      { parse_mode: "HTML" },
    );
    return;
  }

  // Read and send
  const base64 = await box.files.read(zipPath, { encoding: "base64" });
  const buffer = Buffer.from(base64, "base64");

  try {
    if (overBotLimit) {
      await mtproto.sendDocument(ctx.chat!.id, buffer, zipName);
    } else {
      await ctx.replyWithDocument(new InputFile(buffer, zipName));
    }
  } finally {
    // Cleanup
    await box.exec.command(`rm ${shellQuote(zipPath)}`);
  }
}

/** Parse /zip arguments: paths vs natural language. */
export function parseZipArgs(args: string): {
  mode: "all" | "paths" | "help";
  paths: string[];
} {
  const trimmed = args.trim();
  if (!trimmed) return { mode: "all", paths: [] };

  const tokens = trimmed.split(/\s+/);

  // Check for natural language intent keywords
  const intentKeywords = [
    "whole",
    "entire",
    "project",
    "everything",
    "all",
    "send",
  ];
  const hasIntent = tokens.some((t) =>
    intentKeywords.includes(t.toLowerCase()),
  );
  if (hasIntent) return { mode: "all", paths: [] };

  // Check for path-like tokens
  const looksLikePaths = tokens.some(
    (t) =>
      t.includes("/") ||
      t.includes("\\") ||
      t.startsWith(".") ||
      /\.\w+$/.test(t),
  );
  if (looksLikePaths) return { mode: "paths", paths: tokens };

  return { mode: "help", paths: [] };
}
