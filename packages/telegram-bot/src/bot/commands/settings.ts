import type { BotContext } from "../middleware/session.js";
import * as boxManager from "../../services/box-manager.js";
import { updateSession } from "../../services/session-store.js";
import { fmtError, fmtSuccess, escapeHtml } from "../../services/format.js";
import { harnessKeyboard, runtimeKeyboard } from "../keyboards/models.js";
import { isAdmin } from "../middleware/auth.js";

// ── Snapshots ──────────────────────────────────────────────────────

export async function snapshotCommand(ctx: BotContext): Promise<void> {
  const boxId = ctx.session?.activeBoxId;
  if (!boxId) {
    await ctx.reply(fmtError("No active server."), { parse_mode: "HTML" });
    return;
  }

  const name = ctx.match?.toString().trim() || `snap-${Date.now()}`;
  try {
    const box = await boxManager.getBox(boxId);
    const snap = await box.snapshot({ name });
    await ctx.reply(
      fmtSuccess(
        `Snapshot created\nID: <code>${escapeHtml(snap.id)}</code>\nName: ${escapeHtml(snap.name)}`,
      ),
      { parse_mode: "HTML" },
    );
  } catch (e) {
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
  }
}

export async function snapshotsCommand(ctx: BotContext): Promise<void> {
  const boxId = ctx.session?.activeBoxId;
  if (!boxId) {
    await ctx.reply(fmtError("No active server."), { parse_mode: "HTML" });
    return;
  }

  try {
    const box = await boxManager.getBox(boxId);
    const snaps = await box.listSnapshots();
    if (snaps.length === 0) {
      await ctx.reply("No snapshots.", { parse_mode: "HTML" });
      return;
    }

    const lines = snaps.map(
      (s: { id: string; name: string; status: string }) =>
        `<code>${escapeHtml(s.id.slice(0, 12))}</code> — ${escapeHtml(s.name)} (${s.status})`,
    );
    await ctx.reply(`<b>📸 Snapshots</b>\n\n${lines.join("\n")}`, {
      parse_mode: "HTML",
    });
  } catch (e) {
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
  }
}

export async function restoreCommand(ctx: BotContext): Promise<void> {
  const snapshotId = ctx.match?.toString().trim();
  if (!snapshotId) {
    await ctx.reply(fmtError("Usage: /restore &lt;snapshot-id&gt;"), {
      parse_mode: "HTML",
    });
    return;
  }

  try {
    const { Box } = await import("@upstash/box");
    const apiKey = await boxManager.getBoxApiKey();
    const box = await Box.fromSnapshot(snapshotId, { apiKey });
    const userId = ctx.from!.id.toString();
    await boxManager.recordBoxOwner(box.id, userId);
    await updateSession(userId, { activeBoxId: box.id });

    await ctx.reply(
      fmtSuccess(
        `Restored from snapshot. New box: <code>${escapeHtml(box.id)}</code>`,
      ),
      {
        parse_mode: "HTML",
      },
    );
  } catch (e) {
    await ctx.reply(fmtError(e instanceof Error ? e.message : String(e)), {
      parse_mode: "HTML",
    });
  }
}

// ── Settings ───────────────────────────────────────────────────────

export async function modelCommand(ctx: BotContext): Promise<void> {
  await ctx.reply("Select a default agent:", {
    parse_mode: "HTML",
    reply_markup: harnessKeyboard("prefs"),
  });
}

export async function runtimeCommand(ctx: BotContext): Promise<void> {
  await ctx.reply("Select a default runtime:", {
    parse_mode: "HTML",
    reply_markup: runtimeKeyboard("prefs"),
  });
}

export async function keepAliveCommand(ctx: BotContext): Promise<void> {
  const arg = ctx.match?.toString().trim().toLowerCase();
  if (arg !== "on" && arg !== "off") {
    await ctx.reply(
      fmtError("Usage: /keepalive on|off (default for new servers)"),
      { parse_mode: "HTML" },
    );
    return;
  }

  const userId = ctx.from!.id.toString();
  const keepAlive = arg === "on";
  await updateSession(userId, { defaultKeepAlive: keepAlive });
  await ctx.reply(
    keepAlive
      ? fmtSuccess("Keep-alive on — new servers stay always-on.")
      : fmtSuccess("Keep-alive off — new servers auto-pause when idle."),
    { parse_mode: "HTML" },
  );
}

// ── Help ───────────────────────────────────────────────────────────

export async function helpCommand(ctx: BotContext): Promise<void> {
  const hasBox = Boolean(ctx.session?.activeBoxId);
  const admin = isAdmin(ctx.from!.id.toString());

  const sections: string[] = [
    "<b>🧬 MedusaXD Claude Bot — Commands</b>",
    "",
    "<b>Server Management</b>",
    "<code>/create</code> — Create a new server",
    "<code>/list</code> — List all servers",
    "<code>/connect &lt;id&gt;</code> — Connect to a server",
    "<code>/delete &lt;id&gt;</code> — Delete a server",
    "<code>/status</code> — Server status",
  ];

  if (hasBox) {
    sections.push(
      "",
      "<b>AI Agent</b>",
      "<code>/prompt &lt;text&gt;</code> — Ask the AI",
      "<code>/stream &lt;text&gt;</code> — Stream AI response",
      "<code>/task &lt;text&gt;</code> — Run in background, notify when done",
      "<code>/newchat</code> — Reset conversation",
      "<code>/history</code> — Recent runs",
      "",
      "<b>Shell &amp; Preview</b>",
      "<code>/exec &lt;cmd&gt;</code> — Run shell command",
      "<code>/code &lt;lang&gt; &lt;code&gt;</code> — Run code",
      "<code>/preview &lt;port&gt;</code> — Get preview URL",
      "",
      "<b>Files</b>",
      "<code>/ls [path]</code> — List files",
      "<code>/download &lt;path&gt;</code> — Download file",
      "<code>/zip [path]</code> — Zip &amp; download",
      "<code>/upload [dest]</code> — Set upload path",
      "Send a file → auto-upload to box",
      "",
      "<b>Git</b>",
      "<code>/clone &lt;repo&gt;</code> — Clone repo",
      "<code>/diff</code> — Show diff",
      "<code>/commit &lt;msg&gt;</code> — Commit",
      "<code>/push [branch]</code> — Push",
      "<code>/pr &lt;title&gt;</code> — Create PR",
      "",
      "<b>Snapshots</b>",
      "<code>/snapshot [name]</code> — Create snapshot",
      "<code>/snapshots</code> — List snapshots",
      "<code>/restore &lt;id&gt;</code> — Restore from snapshot",
      "",
      "<b>Settings</b>",
      "<code>/model</code> — Change AI model",
      "<code>/runtime</code> — Change default runtime",
      "<code>/keepalive on|off</code> — Always-on default for new servers",
      "<code>/pause</code> / <code>/resume</code> — Lifecycle",
    );
  }

  if (admin) {
    sections.push(
      "",
      "<b>Admin</b>",
      "<code>/setapikey &lt;key&gt;</code> — Update Box API key",
      "<code>/showapikey</code> — Show Box API key",
      "<code>/setagentkey &lt;key&gt;</code> — Update Agent key",
      "<code>/adduser &lt;id&gt;</code> — Add allowed user",
      "<code>/removeuser &lt;id&gt;</code> — Remove user",
      "<code>/botconfig</code> — Show bot config",
    );
  }

  await ctx.reply(sections.join("\n"), { parse_mode: "HTML" });
}
