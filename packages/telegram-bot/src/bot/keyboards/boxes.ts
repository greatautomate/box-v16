import { InlineKeyboard } from "grammy";
import type { BoxData } from "@upstash/box";

const STATUS_EMOJI: Record<string, string> = {
  idle: "🟢",
  running: "🔵",
  creating: "🟡",
  paused: "⚪",
  error: "🔴",
  deleted: "⚫",
};

export const BOX_LIST_PAGE_SIZE = 8;

/** Build a paginated keyboard listing boxes with connect/delete actions. */
export function boxListKeyboard(boxes: BoxData[], page = 0): InlineKeyboard {
  const kb = new InlineKeyboard();
  const pageSize = BOX_LIST_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(boxes.length / pageSize));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * pageSize;
  const slice = boxes.slice(start, start + pageSize);

  for (const box of slice) {
    const emoji = STATUS_EMOJI[box.status] ?? "❓";
    const name = box.name ?? box.id.slice(0, 12);
    const label = `${emoji} ${name}`;

    kb.text(label, `box:connect:${box.id}`)
      .primary()
      .text("🗑", `box:delete:${box.id}`)
      .danger()
      .row();
  }

  if (totalPages > 1) {
    if (safePage > 0) kb.text("◀️ Prev", `list:page:${safePage - 1}`);
    kb.text(`${safePage + 1}/${totalPages}`, "noop");
    if (safePage < totalPages - 1)
      kb.text("Next ▶️", `list:page:${safePage + 1}`);
    kb.row();
  }

  kb.text("🆕 Create New", "menu:create").success().row();
  kb.text("← Back", "menu:back").text("❌ Cancel", "action:cancel");
  return kb;
}
