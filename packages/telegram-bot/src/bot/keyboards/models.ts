import { InlineKeyboard } from "grammy";
import {
  RECOMMENDED_BY_AGENT,
  HARNESS_OPTIONS,
  RUNTIME_OPTIONS,
  flatModelOptions,
} from "../../services/model-registry.js";

export type KeyboardMode = "wizard" | "prefs";

/** Models shown per page in the model keyboard. */
export const MODEL_PAGE_SIZE = 6;

/** Keyboard to select agent harness. */
export function harnessKeyboard(mode: KeyboardMode = "wizard"): InlineKeyboard {
  const prefix = mode === "prefs" ? "prefs:harness:" : "harness:";
  const kb = new InlineKeyboard();
  for (const h of HARNESS_OPTIONS) {
    kb.text(h.label, `${prefix}${h.value}`).primary().row();
  }
  if (mode === "wizard") {
    kb.text("← Back", "wizard:back-runtime").text("❌ Cancel", "action:cancel");
  } else {
    kb.text("❌ Cancel", "menu:back");
  }
  return kb;
}

/**
 * Keyboard to select a model for a given harness. Options are paginated
 * (MODEL_PAGE_SIZE per page); recommended models are marked with a ⭐.
 */
export function modelKeyboard(
  harness: string,
  mode: KeyboardMode = "wizard",
  page = 0,
): InlineKeyboard {
  const options = flatModelOptions(harness);
  if (options.length === 0)
    return new InlineKeyboard().text("No models available", "noop");

  const prefix = mode === "prefs" ? "prefs:model:" : "model:";
  const navTag = mode === "prefs" ? "p" : "w";
  const recommended = new Set(RECOMMENDED_BY_AGENT[harness] ?? []);

  const totalPages = Math.max(1, Math.ceil(options.length / MODEL_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * MODEL_PAGE_SIZE;
  const slice = options.slice(start, start + MODEL_PAGE_SIZE);

  const kb = new InlineKeyboard();
  for (const opt of slice) {
    const label = recommended.has(opt.value) ? `⭐ ${opt.label}` : opt.label;
    kb.text(label, `${prefix}${opt.value}`).primary().row();
  }

  if (totalPages > 1) {
    if (safePage > 0) kb.text("◀️ Prev", `mdlpage:${navTag}:${safePage - 1}`);
    kb.text(`${safePage + 1}/${totalPages}`, "noop");
    if (safePage < totalPages - 1)
      kb.text("Next ▶️", `mdlpage:${navTag}:${safePage + 1}`);
    kb.row();
  }

  if (mode === "wizard") {
    kb.text("← Back", "wizard:back").text("❌ Cancel", "action:cancel");
  } else {
    kb.text("← Back", "prefs:back-harness").text("❌ Cancel", "menu:back");
  }
  return kb;
}

/** Keyboard to select box size. */
export function sizeKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🟢 Small (2 CPU / 2 GB)", "size:small")
    .success()
    .row()
    .text("🔵 Medium (4 CPU / 8 GB)", "size:medium")
    .primary()
    .row()
    .text("🟡 Large (8 CPU / 16 GB)", "size:large")
    .row()
    .text("← Back", "wizard:back-model")
    .text("❌ Cancel", "action:cancel");
}

/** Keyboard to choose keep-alive (always-on vs. idle auto-pause). */
export function keepAliveKeyboard(current: boolean): InlineKeyboard {
  return new InlineKeyboard()
    .text(`${current ? "✅ " : ""}🔥 Always on`, "keepalive:on")
    .row()
    .text(`${!current ? "✅ " : ""}💤 Allow auto-pause`, "keepalive:off")
    .row()
    .text("← Back", "wizard:back-size")
    .text("❌ Cancel", "action:cancel");
}

/** Keyboard for the create-server confirmation step. */
export function confirmCreateKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Yes", "wizard:confirm-create")
    .success()
    .text("❌ Cancel", "action:cancel")
    .danger()
    .row()
    .text("← Back", "wizard:back-keepalive");
}

/** Keyboard to select runtime. */
export function runtimeKeyboard(mode: KeyboardMode = "wizard"): InlineKeyboard {
  const prefix = mode === "prefs" ? "prefs:runtime:" : "runtime:";
  const kb = new InlineKeyboard();
  for (let i = 0; i < RUNTIME_OPTIONS.length; i++) {
    const rt = RUNTIME_OPTIONS[i]!;
    kb.text(rt.label, `${prefix}${rt.value}`).primary();
    if (i % 2 === 1) kb.row();
  }
  if (RUNTIME_OPTIONS.length % 2 === 1) kb.row();
  if (mode === "wizard") {
    kb.text("← Back", "menu:back").text("❌ Cancel", "action:cancel");
  } else {
    kb.text("❌ Cancel", "menu:back");
  }
  return kb;
}
