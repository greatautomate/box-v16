import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  mdToTelegramHtml,
  splitMessage,
} from "../services/format.js";

/** Count non-overlapping occurrences of a substring. */
function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("escapeHtml", () => {
  it("escapes &, < and >", () => {
    expect(escapeHtml("<b> & </b>")).toBe("&lt;b&gt; &amp; &lt;/b&gt;");
  });
});

describe("mdToTelegramHtml links", () => {
  it("renders https links as anchors", () => {
    const out = mdToTelegramHtml("[docs](https://example.com)");
    expect(out).toBe('<a href="https://example.com">docs</a>');
  });

  it("rejects javascript: scheme and renders inert text", () => {
    const out = mdToTelegramHtml("[x](javascript:alert(1))");
    expect(out).not.toContain("<a ");
    expect(out).toContain("javascript:alert(1)");
  });

  it("neutralizes quotes that try to break out of the href attribute", () => {
    const out = mdToTelegramHtml('[x](https://e.com/")');
    // The closing paren stops the URL match before the quote, but any quote
    // that does reach the href must be entity-encoded, never raw.
    expect(out).not.toMatch(/href="[^"]*"[^>]*"/);
  });

  it("escapes raw HTML in surrounding text", () => {
    const out = mdToTelegramHtml("a <script> tag");
    expect(out).toContain("&lt;script&gt;");
  });
});

describe("splitMessage", () => {
  it("returns a single chunk when under the limit", () => {
    expect(splitMessage("hello", 4096)).toEqual(["hello"]);
  });

  it("keeps every chunk within maxLen", () => {
    const text = "a\n".repeat(5000); // 10k chars
    const chunks = splitMessage(text, 100);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(100);
    // No characters lost (chunks reassemble to the original here — no open tags).
    expect(chunks.join("")).toBe(text);
  });

  it("never leaves a <pre><code> block unbalanced across chunks", () => {
    const code = "console.log(1);\n".repeat(60);
    const html = `<pre><code class="language-js">${code}</code></pre>`;
    const chunks = splitMessage(html, 200);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      // Each chunk must open and close pre/code an equal number of times.
      expect(count(c, "<pre>")).toBe(count(c, "</pre>"));
      expect(count(c, "<code")).toBe(count(c, "</code>"));
      // A chunk that contains body text must be wrapped, not bare.
      if (c.includes("console.log")) {
        expect(c.startsWith("<pre><code")).toBe(true);
        expect(c.endsWith("</code></pre>")).toBe(true);
      }
    }
  });

  it("does not cut through an HTML entity", () => {
    // 400 escaped ampersands; each entity is 5 chars ("&amp;").
    const html = "&amp;".repeat(400);
    const chunks = splitMessage(html, 97); // deliberately not a multiple of 5
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      // Every '&' must be part of a complete "&amp;" — no dangling fragments.
      expect(c.replace(/&amp;/g, "")).not.toMatch(/[&;]/);
    }
    expect(chunks.join("")).toBe(html);
  });

  it("splits a mix of formatted text without breaking tags", () => {
    const html = "<b>bold</b> and <i>italic</i> text\n".repeat(50).trim();
    const chunks = splitMessage(html, 120);
    for (const c of chunks) {
      expect(count(c, "<b>")).toBe(count(c, "</b>"));
      expect(count(c, "<i>")).toBe(count(c, "</i>"));
      expect(c.length).toBeLessThanOrEqual(120);
    }
  });
});
