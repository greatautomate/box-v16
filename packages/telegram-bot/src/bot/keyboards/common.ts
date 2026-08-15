import { InlineKeyboard } from "grammy";

/** Confirm/cancel keyboard for destructive actions. */
export function confirmKeyboard(
  confirmData: string,
  cancelData = "action:cancel",
): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Yes", confirmData)
    .success()
    .text("❌ Cancel", cancelData)
    .danger();
}

/** Main menu keyboard shown on /start. */
export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🆕 Create Server", "menu:create")
    .success()
    .text("📋 My Servers", "menu:list")
    .primary()
    .row()
    .text("⚙️ Settings", "menu:settings")
    .text("❓ Help", "menu:help");
}

/** Box action panel shown after connecting to a box. */
export function boxActionKeyboard(boxId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("💬 Prompt", `action:prompt:${boxId}`)
    .primary()
    .text("📁 Files", `action:ls:${boxId}`)
    .primary()
    .text("🔧 Exec", `action:exec:${boxId}`)
    .row()
    .text("📦 Git", `action:git:${boxId}`)
    .text("📸 Snapshot", `action:snapshot:${boxId}`)
    .text("🌐 Preview", `action:preview:${boxId}`)
    .row()
    .text("⏸ Pause", `box:pause:${boxId}`)
    .text("📊 Status", `box:status:${boxId}`)
    .primary()
    .text("🗑 Delete", `box:delete:${boxId}`)
    .danger();
}

/** Back button. */
export function backKeyboard(data = "menu:back"): InlineKeyboard {
  return new InlineKeyboard().text("← Back", data);
}
