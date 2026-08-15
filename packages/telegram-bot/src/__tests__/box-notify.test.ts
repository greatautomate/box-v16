import { describe, it, expect } from "vitest";
import { payloadSchema, renderNotification } from "../services/box-notify.js";

describe("payloadSchema", () => {
  it("accepts a well-formed completed payload", () => {
    const r = payloadSchema.safeParse({
      box_id: "box_123",
      status: "completed",
      output: "done",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a missing box_id", () => {
    const r = payloadSchema.safeParse({ status: "completed" });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown status", () => {
    const r = payloadSchema.safeParse({ box_id: "b", status: "running" });
    expect(r.success).toBe(false);
  });
});

describe("renderNotification", () => {
  it("renders a completed task with its output", () => {
    const [msg] = renderNotification(
      { box_id: "b", status: "completed", output: "**all green**" },
      "my-server",
    );
    expect(msg).toContain("✅ Task completed on my-server");
    expect(msg).toContain("<b>all green</b>"); // markdown converted to HTML
  });

  it("renders a failed task with its error", () => {
    const [msg] = renderNotification(
      { box_id: "b", status: "failed", error: "boom" },
      "my-server",
    );
    expect(msg).toContain("❌ Task failed on my-server");
    expect(msg).toContain("boom");
  });

  it("handles a completed task with no output", () => {
    const [msg] = renderNotification(
      { box_id: "b", status: "completed" },
      "srv",
    );
    expect(msg).toContain("(no output)");
  });

  it("escapes the server name", () => {
    const [msg] = renderNotification(
      { box_id: "b", status: "completed", output: "ok" },
      "<script>",
    );
    expect(msg).toContain("&lt;script&gt;");
    expect(msg).not.toContain("<script>");
  });

  it("splits very long output into Telegram-sized chunks", () => {
    const output = "line\n".repeat(3000); // ~15k chars
    const chunks = renderNotification(
      { box_id: "b", status: "completed", output },
      "srv",
    );
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(4096);
  });
});
