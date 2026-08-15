import { Bot } from "grammy";
import { config, BOT_NAME } from "../config.js";
import type { BotContext } from "./middleware/session.js";
import type { ISession } from "../db/models/session.js";
import { authMiddleware, adminOnly } from "./middleware/auth.js";
import { sessionMiddleware } from "./middleware/session.js";

// Commands & services
import {
  startCommand,
  createCommand,
  listCommand,
  connectCommand,
  deleteCommand,
  pauseCommand,
  resumeCommand,
  statusCommand,
} from "./commands/box.js";
import * as boxManager from "../services/box-manager.js";
import { updateSession, getSession } from "../services/session-store.js";
import { MODEL_OPTIONS_BY_AGENT } from "../services/model-registry.js";
import {
  fmtSuccess,
  fmtError,
  fmtBoxInfo,
  escapeHtml,
} from "../services/format.js";
import {
  boxActionKeyboard,
  backKeyboard,
  confirmKeyboard,
  mainMenuKeyboard,
} from "./keyboards/common.js";
import {
  modelKeyboard,
  runtimeKeyboard,
  harnessKeyboard,
  sizeKeyboard,
  keepAliveKeyboard,
  confirmCreateKeyboard,
} from "./keyboards/models.js";
import { boxListKeyboard } from "./keyboards/boxes.js";
import {
  setApiKeyCommand,
  showApiKeyCommand,
  setAgentKeyCommand,
  addUserCommand,
  removeUserCommand,
  botConfigCommand,
} from "./commands/admin.js";
import {
  promptCommand,
  streamCommand,
  taskCommand,
  directMessageHandler,
  newchatCommand,
  historyCommand,
} from "./commands/agent.js";
import {
  execCommand,
  codeCommand,
  previewCommand,
  previewsCommand,
} from "./commands/exec.js";
import {
  documentHandler,
  uploadCommand,
  downloadCommand,
  zipCommand,
  lsCommand,
} from "./commands/files.js";
import {
  cloneCommand,
  diffCommand,
  commitCommand,
  pushCommand,
  prCommand,
} from "./commands/git.js";
import {
  snapshotCommand,
  snapshotsCommand,
  restoreCommand,
  modelCommand,
  runtimeCommand,
  keepAliveCommand,
  helpCommand,
} from "./commands/settings.js";

/** Prompt shown at the keep-alive wizard step. */
const KEEPALIVE_PROMPT = [
  "<b>Keep this server always on?</b>",
  "",
  "🔥 <b>Always on</b> — never auto-pauses (costs more while idle).",
  "💤 <b>Allow auto-pause</b> — hibernates when idle to save cost.",
].join("\n");

/** Render the create-server confirmation summary from the wizard session. */
function createSummaryText(session: ISession): string {
  return [
    "<b>🧬 Create Server?</b>",
    "",
    `<b>Runtime:</b> ${escapeHtml(session.defaultRuntime || "node")}`,
    `<b>Agent:</b> ${escapeHtml(session.defaultHarness || "claude-code")}`,
    `<b>Model:</b> <code>${escapeHtml(session.defaultModel)}</code>`,
    `<b>Size:</b> ${escapeHtml(session.wizardSize || "small")}`,
    `<b>Keep alive:</b> ${session.wizardKeepAlive ? "🔥 Always on" : "💤 Auto-pause"}`,
  ].join("\n");
}

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(config.telegramBotToken);

  // ── Global middleware ────────────────────────────────────────────
  bot.use(authMiddleware as Parameters<typeof bot.use>[0]);
  bot.use(sessionMiddleware);

  // ── Public commands ──────────────────────────────────────────────
  bot.command("start", startCommand);
  bot.command("help", helpCommand);
  bot.command("create", createCommand);
  bot.command("list", listCommand);
  bot.command("connect", connectCommand);
  bot.command("delete", deleteCommand);
  bot.command("pause", pauseCommand);
  bot.command("resume", resumeCommand);
  bot.command("status", statusCommand);

  // Agent
  bot.command("prompt", promptCommand);
  bot.command("stream", streamCommand);
  bot.command("task", taskCommand);
  bot.command("newchat", newchatCommand);
  bot.command("history", historyCommand);

  // Shell & Preview
  bot.command("exec", execCommand);
  bot.command("code", codeCommand);
  bot.command("preview", previewCommand);
  bot.command("previews", previewsCommand);

  // Files
  bot.command("upload", uploadCommand);
  bot.command("download", downloadCommand);
  bot.command("zip", zipCommand);
  bot.command("ls", lsCommand);

  // Git
  bot.command("clone", cloneCommand);
  bot.command("diff", diffCommand);
  bot.command("commit", commitCommand);
  bot.command("push", pushCommand);
  bot.command("pr", prCommand);

  // Snapshots
  bot.command("snapshot", snapshotCommand);
  bot.command("snapshots", snapshotsCommand);
  bot.command("restore", restoreCommand);

  // Settings
  bot.command("model", modelCommand);
  bot.command("runtime", runtimeCommand);
  bot.command("keepalive", keepAliveCommand);

  // ── Admin-only commands ──────────────────────────────────────────
  bot.command(
    "setapikey",
    adminOnly as Parameters<typeof bot.use>[0],
    setApiKeyCommand,
  );
  bot.command(
    "showapikey",
    adminOnly as Parameters<typeof bot.use>[0],
    showApiKeyCommand,
  );
  bot.command(
    "setagentkey",
    adminOnly as Parameters<typeof bot.use>[0],
    setAgentKeyCommand,
  );
  bot.command(
    "adduser",
    adminOnly as Parameters<typeof bot.use>[0],
    addUserCommand,
  );
  bot.command(
    "removeuser",
    adminOnly as Parameters<typeof bot.use>[0],
    removeUserCommand,
  );
  bot.command(
    "botconfig",
    adminOnly as Parameters<typeof bot.use>[0],
    botConfigCommand,
  );

  // ── File uploads (document/photo) ────────────────────────────────
  bot.on(":document", documentHandler);
  bot.on(":photo", documentHandler);

  // ── Callback queries ─────────────────────────────────────────────
  bot.callbackQuery("action:cancel", async (ctx) => {
    await ctx.answerCallbackQuery("Cancelled");
    await ctx.deleteMessage().catch(() => {});
  });

  bot.callbackQuery("noop", async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  // Main menu buttons
  bot.callbackQuery("menu:create", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("Select a runtime:", {
      parse_mode: "HTML",
      reply_markup: runtimeKeyboard(),
    });
  });
  bot.callbackQuery("menu:list", async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderBoxList(ctx, 0);
  });
  bot.callbackQuery(/^list:page:(\d+)$/, async (ctx) => {
    const page = parseInt(ctx.match![1]!, 10);
    await ctx.answerCallbackQuery();
    await renderBoxList(ctx, page);
  });
  bot.callbackQuery("menu:settings", async (ctx) => {
    await ctx.answerCallbackQuery();
    await modelCommand(ctx);
  });
  bot.callbackQuery("menu:help", async (ctx) => {
    await ctx.answerCallbackQuery();
    await helpCommand(ctx);
  });
  bot.callbackQuery("menu:back", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `<b>🧬 ${escapeHtml(BOT_NAME)}</b>\n\nWelcome to MedusaXD AI coding assistant.\nCreate Servers, prompt AI agents, manage files — all from Telegram. @medusaXD`,
      { parse_mode: "HTML", reply_markup: mainMenuKeyboard() },
    );
  });

  // Box actions (connect, delete, pause, status)
  bot.callbackQuery(/^box:connect:(.+)$/, async (ctx) => {
    const boxId = ctx.match![1]!;
    await ctx.answerCallbackQuery();
    try {
      const userId = ctx.from.id.toString();
      const box = await boxManager.getBox(boxId);
      await boxManager.assertBoxAccess(box.id, userId);
      await updateSession(userId, { activeBoxId: box.id });
      await ctx.editMessageText(
        `${fmtSuccess("Connected to server")}\n${fmtBoxInfo({ id: box.id, model: box.modelConfig.model })}`,
        { parse_mode: "HTML", reply_markup: boxActionKeyboard(box.id) },
      );
    } catch (e) {
      await ctx.editMessageText(
        fmtError(e instanceof Error ? e.message : String(e)),
        { parse_mode: "HTML" },
      );
    }
  });

  bot.callbackQuery(/^box:delete:(.+)$/, async (ctx) => {
    const boxId = ctx.match![1]!;
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `Delete server <code>${escapeHtml(boxId)}</code>? This is irreversible.`,
      {
        parse_mode: "HTML",
        reply_markup: confirmKeyboard(`box:confirm-delete:${boxId}`),
      },
    );
  });

  bot.callbackQuery(/^box:confirm-delete:(.+)$/, async (ctx) => {
    const boxId = ctx.match![1]!;
    await ctx.answerCallbackQuery();
    try {
      const userId = ctx.from.id.toString();
      await boxManager.assertBoxAccess(boxId, userId);
      await boxManager.deleteBox(boxId);
      await updateSession(userId, { activeBoxId: null });
      await ctx.editMessageText(fmtSuccess("Server deleted"), {
        parse_mode: "HTML",
      });
    } catch (e) {
      await ctx.editMessageText(
        fmtError(e instanceof Error ? e.message : String(e)),
        { parse_mode: "HTML" },
      );
    }
  });

  bot.callbackQuery(/^box:pause:(.+)$/, async (ctx) => {
    const boxId = ctx.match![1]!;
    await ctx.answerCallbackQuery();
    try {
      await boxManager.assertBoxAccess(boxId, ctx.from.id.toString());
      const box = await boxManager.getBox(boxId);
      await box.pause();
      await ctx.editMessageText(fmtSuccess("Server paused"), {
        parse_mode: "HTML",
      });
    } catch (e) {
      await ctx.answerCallbackQuery(e instanceof Error ? e.message : "Error");
    }
  });

  bot.callbackQuery(/^box:status:(.+)$/, async (ctx) => {
    const boxId = ctx.match![1]!;
    await ctx.answerCallbackQuery();
    try {
      await boxManager.assertBoxAccess(boxId, ctx.from.id.toString());
      const box = await boxManager.getBox(boxId);
      const { status } = await box.getStatus();
      await ctx.editMessageText(
        fmtBoxInfo({ id: box.id, status, model: box.modelConfig.model }),
        { parse_mode: "HTML", reply_markup: boxActionKeyboard(box.id) },
      );
    } catch (e) {
      await ctx.answerCallbackQuery(e instanceof Error ? e.message : "Error");
    }
  });

  // Box action panel buttons
  bot.callbackQuery(/^action:prompt:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("Send me a message and I'll prompt the AI agent.");
  });
  bot.callbackQuery(/^action:ls:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await lsCommand(ctx);
  });
  bot.callbackQuery(/^action:exec:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      "Use <code>/exec &lt;command&gt;</code> to run a shell command.",
      { parse_mode: "HTML" },
    );
  });
  bot.callbackQuery(/^action:git:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("Git commands: /clone, /diff, /commit, /push, /pr");
  });
  bot.callbackQuery(/^action:snapshot:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await snapshotCommand(ctx);
  });
  bot.callbackQuery(/^action:preview:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      "Use <code>/preview &lt;port&gt;</code> to get a public URL.",
      { parse_mode: "HTML" },
    );
  });

  // Runtime selection (create wizard)
  bot.callbackQuery(/^runtime:(.+)$/, async (ctx) => {
    const runtime = ctx.match![1]!;
    await ctx.answerCallbackQuery();
    const userId = ctx.from.id.toString();
    await updateSession(userId, { defaultRuntime: runtime });
    await ctx.editMessageText("Select an AI agent:", {
      parse_mode: "HTML",
      reply_markup: harnessKeyboard(),
    });
  });

  // Harness selection
  bot.callbackQuery(/^harness:(.+)$/, async (ctx) => {
    const harness = ctx.match![1]!;
    await ctx.answerCallbackQuery();
    const userId = ctx.from.id.toString();
    await updateSession(userId, { defaultHarness: harness });
    await ctx.editMessageText("Select a model:", {
      parse_mode: "HTML",
      reply_markup: modelKeyboard(harness),
    });
  });

  // Model list pagination (w = wizard, p = prefs)
  bot.callbackQuery(/^mdlpage:(w|p):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from.id.toString();
    const session = await getSession(userId);
    const harness = session.defaultHarness || "claude-code";
    const mode = ctx.match![1] === "p" ? "prefs" : "wizard";
    const page = parseInt(ctx.match![2]!, 10);
    await ctx.editMessageReplyMarkup({
      reply_markup: modelKeyboard(harness, mode, page),
    });
  });

  // Model selection → box size
  bot.callbackQuery(/^model:(.+)$/, async (ctx) => {
    const model = ctx.match![1]!;
    const userId = ctx.from.id.toString();
    const session = await getSession(userId);
    const harness = session.defaultHarness || "claude-code";
    const valid = (MODEL_OPTIONS_BY_AGENT[harness] ?? []).some((g) =>
      g.options.some((o) => o.value === model),
    );
    if (!valid) {
      await ctx.answerCallbackQuery({
        text: "Pick a model for the current agent.",
        show_alert: true,
      });
      await ctx.editMessageText("Select a model:", {
        parse_mode: "HTML",
        reply_markup: modelKeyboard(harness),
      });
      return;
    }
    await ctx.answerCallbackQuery();
    await updateSession(userId, { defaultModel: model });
    await ctx.editMessageText("<b>Select Server Specs:</b>", {
      parse_mode: "HTML",
      reply_markup: sizeKeyboard(),
    });
  });

  // Size selection → confirmation
  bot.callbackQuery(/^size:(.+)$/, async (ctx) => {
    const size = ctx.match![1]!;
    await ctx.answerCallbackQuery();
    const userId = ctx.from.id.toString();
    // Seed the per-creation keep-alive choice from the user's saved default.
    const session = await getSession(userId);
    await updateSession(userId, {
      wizardSize: size,
      wizardKeepAlive: session.defaultKeepAlive,
    });

    await ctx.editMessageText(KEEPALIVE_PROMPT, {
      parse_mode: "HTML",
      reply_markup: keepAliveKeyboard(session.defaultKeepAlive),
    });
  });

  // Keep-alive selection → confirmation
  bot.callbackQuery(/^keepalive:(on|off)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from.id.toString();
    const keepAlive = ctx.match![1] === "on";
    await updateSession(userId, { wizardKeepAlive: keepAlive });
    const session = await getSession(userId);

    await ctx.editMessageText(createSummaryText(session), {
      parse_mode: "HTML",
      reply_markup: confirmCreateKeyboard(),
    });
  });

  // Back buttons for wizard steps
  bot.callbackQuery("wizard:back-runtime", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("Select a runtime:", {
      parse_mode: "HTML",
      reply_markup: runtimeKeyboard(),
    });
  });
  bot.callbackQuery("wizard:back-model", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from.id.toString();
    const session = await getSession(userId);
    await ctx.editMessageText("Select a model:", {
      parse_mode: "HTML",
      reply_markup: modelKeyboard(session.defaultHarness || "claude-code"),
    });
  });
  bot.callbackQuery("wizard:back-size", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("<b>Select Server Specs:</b>", {
      parse_mode: "HTML",
      reply_markup: sizeKeyboard(),
    });
  });
  bot.callbackQuery("wizard:back-keepalive", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from.id.toString();
    const session = await getSession(userId);
    await ctx.editMessageText(KEEPALIVE_PROMPT, {
      parse_mode: "HTML",
      reply_markup: keepAliveKeyboard(session.wizardKeepAlive),
    });
  });

  // Confirm box creation
  bot.callbackQuery("wizard:confirm-create", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from.id.toString();
    const session = await getSession(userId);

    await ctx.editMessageText(
      "<i>⏳ Creating server... this may take ~10s</i>",
      { parse_mode: "HTML" },
    );

    try {
      const box = await boxManager.createBox({
        runtime: session.defaultRuntime || "node",
        harness: session.defaultHarness || "claude-code",
        model: session.defaultModel,
        size: (session.wizardSize || "small") as "small" | "medium" | "large",
        keepAlive: session.wizardKeepAlive,
      });
      await boxManager.recordBoxOwner(box.id, userId);
      await updateSession(userId, { activeBoxId: box.id });

      const keepAliveLine = session.wizardKeepAlive
        ? "\n<i>🔥 Keep-alive on — won't auto-pause.</i>"
        : "\n<i>💤 Keep-alive off — pauses when idle.</i>";
      await ctx.editMessageText(
        `${fmtSuccess("Server created!")}\n${fmtBoxInfo({ id: box.id, model: box.modelConfig.model })}${keepAliveLine}`,
        { parse_mode: "HTML", reply_markup: boxActionKeyboard(box.id) },
      );
    } catch (e) {
      await ctx.editMessageText(
        fmtError(e instanceof Error ? e.message : String(e)),
        { parse_mode: "HTML" },
      );
    }
  });

  // Wizard back
  bot.callbackQuery("wizard:back", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("Select an AI agent:", {
      parse_mode: "HTML",
      reply_markup: harnessKeyboard(),
    });
  });

  // ── Preferences flow (/model, /runtime, Settings button) ─────────
  // Saves the user's defaults without advancing to box creation.
  bot.callbackQuery(/^prefs:harness:(.+)$/, async (ctx) => {
    const harness = ctx.match![1]!;
    await ctx.answerCallbackQuery();
    const userId = ctx.from.id.toString();
    await updateSession(userId, { defaultHarness: harness });
    await ctx.editMessageText("Select a default model:", {
      parse_mode: "HTML",
      reply_markup: modelKeyboard(harness, "prefs"),
    });
  });

  bot.callbackQuery(/^prefs:model:(.+)$/, async (ctx) => {
    const model = ctx.match![1]!;
    const userId = ctx.from.id.toString();
    const session = await getSession(userId);
    const harness = session.defaultHarness || "claude-code";
    const valid = (MODEL_OPTIONS_BY_AGENT[harness] ?? []).some((g) =>
      g.options.some((o) => o.value === model),
    );
    if (!valid) {
      await ctx.answerCallbackQuery({
        text: "Pick a model for the current agent.",
        show_alert: true,
      });
      await ctx.editMessageText("Select a default model:", {
        parse_mode: "HTML",
        reply_markup: modelKeyboard(harness, "prefs"),
      });
      return;
    }
    await ctx.answerCallbackQuery();
    await updateSession(userId, { defaultModel: model });
    await ctx.editMessageText(
      fmtSuccess(`Default model saved: <code>${escapeHtml(model)}</code>`),
      { parse_mode: "HTML" },
    );
  });

  bot.callbackQuery(/^prefs:runtime:(.+)$/, async (ctx) => {
    const runtime = ctx.match![1]!;
    await ctx.answerCallbackQuery();
    const userId = ctx.from.id.toString();
    await updateSession(userId, { defaultRuntime: runtime });
    await ctx.editMessageText(
      fmtSuccess(`Default runtime saved: <code>${escapeHtml(runtime)}</code>`),
      { parse_mode: "HTML" },
    );
  });

  bot.callbackQuery("prefs:back-harness", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("Select a default agent:", {
      parse_mode: "HTML",
      reply_markup: harnessKeyboard("prefs"),
    });
  });

  // Catch-all for unhandled callbacks
  bot.on("callback_query:data", async (ctx) => {
    console.log("Unhandled callback:", ctx.callbackQuery.data);
    await ctx.answerCallbackQuery();
  });

  // ── Direct messages → agent prompt ───────────────────────────────
  bot.on("message:text", directMessageHandler);

  // ── Error handler ────────────────────────────────────────────────
  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  return bot;
}

/** Render the box list with pagination, editing the current message in place. */
async function renderBoxList(ctx: BotContext, page: number): Promise<void> {
  try {
    const boxes = await boxManager.listBoxesForUser(ctx.from!.id.toString());
    if (boxes.length === 0) {
      await ctx.editMessageText(
        "<b>📋 Your Servers</b>\n\nNo servers yet. Create one to get started.",
        {
          parse_mode: "HTML",
          reply_markup: new (await import("grammy")).InlineKeyboard()
            .text("🆕 Create New", "menu:create")
            .success()
            .row()
            .text("← Back", "menu:back")
            .text("❌ Cancel", "action:cancel"),
        },
      );
      return;
    }
    await ctx.editMessageText(`<b>📋 Your Servers (${boxes.length})</b>`, {
      parse_mode: "HTML",
      reply_markup: boxListKeyboard(boxes, page),
    });
  } catch (e) {
    await ctx.editMessageText(
      fmtError(e instanceof Error ? e.message : String(e)),
      {
        parse_mode: "HTML",
        reply_markup: backKeyboard(),
      },
    );
  }
}
